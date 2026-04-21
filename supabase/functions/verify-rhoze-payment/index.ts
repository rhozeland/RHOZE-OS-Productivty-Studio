import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey, clusterApiUrl } from "https://esm.sh/@solana/web3.js@1.98.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RHOZE_MINT = "7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump";
const TREASURY_ADDRESS = "6znjR2ttDJ5c6ScePsE4jU8e2g29dChX7cCVk6xjizr";
const NETWORK = "mainnet-beta";
const RHOZE_DECIMALS = 6;

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

    if (!signature || !expected_tokens) {
      return new Response(JSON.stringify({ error: "Missing required fields: signature, expected_tokens" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connection = new Connection(clusterApiUrl(NETWORK));
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

    // Look for SPL token transfer to treasury
    const innerInstructions = tx.meta?.innerInstructions ?? [];
    const mainInstructions = tx.transaction.message.instructions ?? [];
    const allInstructions = [...mainInstructions, ...innerInstructions.flatMap((i: any) => i.instructions)];

    let transferFound = false;
    let transferAmount = 0;

    for (const ix of allInstructions) {
      const parsed = (ix as any).parsed;
      if (!parsed) continue;

      if (
        parsed.type === "transfer" &&
        parsed.info?.mint === RHOZE_MINT
      ) {
        transferAmount = Number(parsed.info.amount || parsed.info.tokenAmount?.amount || 0);
        transferFound = true;
        break;
      }

      if (
        parsed.type === "transferChecked" &&
        parsed.info?.mint === RHOZE_MINT
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
        if (post.mint !== RHOZE_MINT) continue;
        if (post.owner !== TREASURY_ADDRESS) continue;

        const pre = preTokenBalances.find(
          (p: any) => p.accountIndex === post.accountIndex && p.mint === RHOZE_MINT
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

    const receivedTokens = transferAmount / Math.pow(10, RHOZE_DECIMALS);
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

    // Prevent double-spend
    const { data: existingTx } = await supabaseAdmin
      .from("credit_transactions")
      .select("id")
      .eq("payment_reference", signature)
      .maybeSingle();

    if (existingTx) {
      return new Response(JSON.stringify({ error: "Transaction already processed" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (creditsToAdd > 0) {
      // Credit user
      const { data: existing } = await supabaseAdmin
        .from("user_credits")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin
          .from("user_credits")
          .update({ balance: existing.balance + creditsToAdd, updated_at: new Date().toISOString() })
          .eq("user_id", user.id);
      } else {
        await supabaseAdmin
          .from("user_credits")
          .insert({ user_id: user.id, balance: creditsToAdd });
      }
    }

    await supabaseAdmin
      .from("credit_transactions")
      .insert({
        user_id: user.id,
        amount: creditsToAdd,
        type: type || (isSubscription ? "subscription" : "purchase"),
        description: description || (isSubscription
          ? `Subscription payment via $RHOZE (${receivedTokens} tokens)`
          : `${creditsToAdd} credit(s) via $RHOZE token`),
        payment_method: "rhoze_token",
        payment_reference: signature,
      });

    return new Response(
      JSON.stringify({ success: true, credits_added: creditsToAdd, tokens_received: receivedTokens }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("verify-rhoze-payment error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
