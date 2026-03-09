import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } from "https://esm.sh/@solana/web3.js@1.98.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TREASURY_ADDRESS = "6znjR2ttDJ5c6ScePsE4jU8e2g29dChX7cCVk6xjizr";
const NETWORK = "mainnet-beta";

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

    const { signature, expected_sol, credits_to_add, description, type } = await req.json();

    if (!signature || !expected_sol || !credits_to_add) {
      return new Response(JSON.stringify({ error: "Missing required fields: signature, expected_sol, credits_to_add" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the transaction on-chain
    const connection = new Connection(clusterApiUrl(NETWORK));
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

    // Verify the transaction sent SOL to our treasury
    const treasuryPubkey = new PublicKey(TREASURY_ADDRESS);
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

    // Use service role to credit the user
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if this signature was already processed (prevent double-spend)
    const { data: existingTx } = await supabaseAdmin
      .from("credit_transactions")
      .select("id")
      .eq("payment_reference", signature)
      .maybeSingle();

    if (existingTx) {
      return new Response(JSON.stringify({ error: "This transaction has already been processed" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert user credits
    const { data: existing } = await supabaseAdmin
      .from("user_credits")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("user_credits")
        .update({ balance: existing.balance + credits_to_add, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("user_credits")
        .insert({ user_id: user.id, balance: credits_to_add });
      if (error) throw error;
    }

    // Log the transaction
    const { error: txErr } = await supabaseAdmin
      .from("credit_transactions")
      .insert({
        user_id: user.id,
        amount: credits_to_add,
        type: type || "purchase",
        description: description || `${credits_to_add} credit(s) via SOL`,
        payment_method: "crypto",
        payment_reference: signature,
      });
    if (txErr) throw txErr;

    return new Response(
      JSON.stringify({ success: true, credits_added: credits_to_add, sol_received: receivedSol }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("verify-sol-payment error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
