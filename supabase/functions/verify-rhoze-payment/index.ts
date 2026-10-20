import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey } from "https://esm.sh/@solana/web3.js@1.98.4";
import { getSolanaConfig } from "../_shared/solana-config.ts";
import { verifySolanaCluster } from "../_shared/solana-cluster.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Server-side conversion rate: 100 $RHOZE ≈ 1 USD ≈ 1 credit
// Adjust here only — never trust client values.
const RHOZE_PER_CREDIT = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { signature, expected_tokens, description, type, intent } = await req.json();

    // Reject the request unless the signature is a properly formatted
    // Base58 string and the expected token amount is a finite positive number.
    if (
      typeof signature !== "string" ||
      !/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(signature) ||
      typeof expected_tokens !== "number" ||
      !Number.isFinite(expected_tokens) ||
      expected_tokens <= 0
    ) {
      return new Response(JSON.stringify({ error: "Missing required fields: signature, expected_tokens" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = getSolanaConfig();
    if (!config.rhozePaymentsEnabled) {
      throw new Error("$RHOZE payments are disabled for this environment");
    }
    const connection = new Connection(config.rpcUrl);
    await verifySolanaCluster(connection, config.cluster);
    const rhozeMint = config.rhozeMint;
    const treasuryAddress = config.treasuryAddress;
    const tx = await connection.getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return new Response(JSON.stringify({ error: "Transaction not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tx.meta?.err) {
      return new Response(JSON.stringify({ error: "Transaction failed on-chain" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("wallet_address")
      .eq("user_id", user.id)
      .maybeSingle();
    const feePayer = tx.transaction.message.accountKeys.find((key: any) => key.signer)?.pubkey;
    if (!profile?.wallet_address || feePayer !== profile.wallet_address) {
      return new Response(JSON.stringify({ error: "Transaction payer does not match your bound wallet" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look for SPL token transfer to treasury
    const innerInstructions = tx.meta?.innerInstructions ?? [];
    const mainInstructions = tx.transaction.message.instructions ?? [];
    const allInstructions = [...mainInstructions, ...innerInstructions.flatMap((i: any) => i.instructions)];

    let transferFound = false;
    let transferAmount = 0;
    const treasuryTokenAccounts = new Set(
      (tx.meta?.postTokenBalances ?? [])
        .filter((balance: any) =>
          balance.mint === rhozeMint &&
          balance.owner === treasuryAddress &&
          (!balance.programId || balance.programId === config.tokenProgramId)
        )
        .map((balance: any) =>
          tx.transaction.message.accountKeys[balance.accountIndex]?.pubkey.toBase58()
        )
        .filter(Boolean),
    );

    for (const ix of allInstructions) {
      const parsed = (ix as any).parsed;
      if (!parsed) continue;

      if (
        parsed.type === "transfer" &&
        parsed.info?.mint === rhozeMint &&
        treasuryTokenAccounts.has(parsed.info?.destination)
      ) {
        transferAmount = Number(parsed.info.amount || parsed.info.tokenAmount?.amount || 0);
        transferFound = true;
        break;
      }

      if (
        parsed.type === "transferChecked" &&
        parsed.info?.mint === rhozeMint &&
        treasuryTokenAccounts.has(parsed.info?.destination)
      ) {
        transferAmount = Number(parsed.info.tokenAmount?.amount || 0);
        transferFound = true;
        break;
      }
    }

    if (!transferFound) {
      // Fallback: check token balance changes
      const preTokenBalances = tx.meta?.preTokenBalances ?? [];
      const postTokenBalances = tx.meta?.postTokenBalances ?? [];

      for (const post of postTokenBalances) {
        if (post.mint !== rhozeMint) continue;
        if (post.owner !== treasuryAddress) continue;

        const pre = preTokenBalances.find(
          (p: any) => p.accountIndex === post.accountIndex && p.mint === rhozeMint
        );
        const preAmount = Number(pre?.uiTokenAmount?.amount ?? "0");
        const postAmount = Number(post.uiTokenAmount?.amount ?? "0");
        transferAmount = postAmount - preAmount;
        if (transferAmount > 0) {
          transferFound = true;
          break;
        }
      }
    }

    if (!transferFound || transferAmount <= 0) {
      return new Response(JSON.stringify({ error: "No $RHOZE transfer to treasury found in transaction" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const receivedTokens = transferAmount / Math.pow(10, config.rhozeDecimals);
    if (receivedTokens < expected_tokens * 0.99) {
      return new Response(JSON.stringify({
        error: `Insufficient $RHOZE. Expected ${expected_tokens}, received ${receivedTokens}`,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECURITY: derive credits server-side from the verified on-chain amount.
    const isSubscription = intent === "subscription" || type === "subscription";
    const creditsToAdd = isSubscription ? 0 : Math.floor(receivedTokens / RHOZE_PER_CREDIT);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: settleError } = await supabaseAdmin.rpc("record_crypto_payment", {
      p_user_id: user.id,
      p_amount: creditsToAdd,
      p_type: type || (isSubscription ? "subscription" : "purchase"),
      p_description: description || (isSubscription
        ? `Subscription payment via $RHOZE (${receivedTokens} tokens)`
        : `${creditsToAdd} credit(s) via $RHOZE token`),
      p_payment_method: "rhoze_token",
      p_payment_reference: signature,
    });
    if (settleError) {
      if (settleError.code === "23505") {
        return new Response(JSON.stringify({ error: "Transaction already processed" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw settleError;
    }

    return new Response(
      JSON.stringify({ success: true, credits_added: creditsToAdd, tokens_received: receivedTokens }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("verify-rhoze-payment error:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
