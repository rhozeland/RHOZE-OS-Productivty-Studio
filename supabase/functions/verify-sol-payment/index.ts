import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "https://esm.sh/@solana/web3.js@1.98.4";
import { getSolanaConfig } from "../_shared/solana-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Server-side conversion rate: 1 SOL ≈ 150 USD (approx) -> 150 credits per SOL.
// Adjust here only — never trust client values.
const CREDITS_PER_SOL = 150;

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

    const { signature, expected_sol, description, type, intent } = await req.json();

    if (!signature || !expected_sol) {
      return new Response(JSON.stringify({ error: "Missing required fields: signature, expected_sol" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the transaction on-chain
    const config = getSolanaConfig();
    if (!config.paymentsEnabled) {
      throw new Error("SOL payments are disabled for this environment");
    }
    const connection = new Connection(config.rpcUrl);
    const tx = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return new Response(JSON.stringify({ error: "Transaction not found or not confirmed" }), {
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

    const feePayer = tx.transaction.message.staticAccountKeys?.[0] ??
      tx.transaction.message.accountKeys?.[0];
    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("wallet_address")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!feePayer || !profile?.wallet_address || feePayer.toBase58() !== profile.wallet_address) {
      return new Response(JSON.stringify({ error: "Transaction payer does not match your bound wallet" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the transaction sent SOL to our treasury
    const treasuryPubkey = new PublicKey(config.treasuryAddress);
    const accountKeys = tx.transaction.message.staticAccountKeys || tx.transaction.message.accountKeys;

    let treasuryIndex = -1;
    for (let i = 0; i < accountKeys.length; i++) {
      if (accountKeys[i].toBase58() === treasuryPubkey.toBase58()) {
        treasuryIndex = i;
        break;
      }
    }

    if (treasuryIndex === -1) {
      return new Response(JSON.stringify({ error: "Transaction does not involve our treasury wallet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check the amount received by treasury
    const preBalance = tx.meta!.preBalances[treasuryIndex];
    const postBalance = tx.meta!.postBalances[treasuryIndex];
    const receivedLamports = postBalance - preBalance;
    const receivedSol = receivedLamports / LAMPORTS_PER_SOL;

    // Allow 1% tolerance for rounding
    if (receivedSol < expected_sol * 0.99) {
      return new Response(JSON.stringify({
        error: `Insufficient payment. Expected ${expected_sol} SOL, received ${receivedSol.toFixed(6)} SOL`,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECURITY: derive credits server-side from the verified on-chain amount.
    // Subscription payments do not award credits (tier benefits are applied separately).
    const isSubscription = intent === "subscription" || type === "subscription";
    const creditsToAdd = isSubscription ? 0 : Math.floor(receivedSol * CREDITS_PER_SOL);

    // Use service role to credit the user
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: settleError } = await supabaseAdmin.rpc("record_crypto_payment", {
      p_user_id: user.id,
      p_amount: creditsToAdd,
      p_type: type || (isSubscription ? "subscription" : "purchase"),
      p_description: description || (isSubscription
        ? `Subscription payment via SOL (${receivedSol.toFixed(4)} SOL)`
        : `${creditsToAdd} credit(s) via SOL`),
      p_payment_method: "crypto",
      p_payment_reference: signature,
    });
    if (settleError) {
      if (settleError.code === "23505") {
        return new Response(JSON.stringify({ error: "This transaction has already been processed" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw settleError;
    }

    return new Response(
      JSON.stringify({ success: true, credits_added: creditsToAdd, sol_received: receivedSol }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("verify-sol-payment error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
