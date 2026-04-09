import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from "https://esm.sh/@solana/web3.js@1.98.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { proof_id } = await req.json();
    if (!proof_id) {
      return new Response(JSON.stringify({ error: "proof_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the contribution proof
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: proof, error: proofError } = await adminClient
      .from("contribution_proofs")
      .select("*")
      .eq("id", proof_id)
      .eq("user_id", user.id)
      .is("solana_signature", null)
      .single();

    if (proofError || !proof) {
      return new Response(
        JSON.stringify({ error: "Proof not found or already anchored" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build memo content
    const memo = JSON.stringify({
      protocol: "rhozeland",
      version: "1",
      type: "contribution",
      action: proof.action_type,
      user: user.id,
      proof_id: proof.id,
      ts: new Date().toISOString(),
      meta: proof.metadata,
    });

    // Sign with airdrop wallet (platform authority)
    const privateKeyStr = Deno.env.get("RHOZE_AIRDROP_PRIVATE_KEY");
    if (!privateKeyStr) {
      return new Response(JSON.stringify({ error: "Airdrop wallet not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const privateKeyArray = JSON.parse(privateKeyStr);
    const keypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));

    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

    const memoInstruction = new TransactionInstruction({
      keys: [{ pubkey: keypair.publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: new TextEncoder().encode(memo),
    });

    const transaction = new Transaction().add(memoInstruction);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = keypair.publicKey;
    transaction.sign(keypair);

    const signature = await connection.sendRawTransaction(transaction.serialize());

    // Update proof with signature
    await adminClient
      .from("contribution_proofs")
      .update({
        solana_signature: signature,
        anchored_at: new Date().toISOString(),
      })
      .eq("id", proof_id);

    return new Response(
      JSON.stringify({ signature, explorer: `https://solscan.io/tx/${signature}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
