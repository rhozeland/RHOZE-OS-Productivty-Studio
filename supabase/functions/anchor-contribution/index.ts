import { createClient } from "npm:@supabase/supabase-js@2";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from "npm:@solana/web3.js@1.98.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return respond(401, { error: "No auth" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return respond(401, { error: "Unauthorized" });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return respond(400, { error: "Invalid JSON body" });
    }

    const proof_id = body.proof_id as string | undefined;
    if (!proof_id) {
      return respond(400, { error: "proof_id required" });
    }

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
      return respond(404, { error: "Proof not found or already anchored" });
    }

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

    const privateKeyStr = Deno.env.get("RHOZE_AIRDROP_PRIVATE_KEY");
    if (!privateKeyStr) {
      return respond(500, { error: "Airdrop wallet not configured" });
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

    await adminClient
      .from("contribution_proofs")
      .update({
        solana_signature: signature,
        anchored_at: new Date().toISOString(),
      })
      .eq("id", proof_id);

    return respond(200, { signature, explorer: `https://solscan.io/tx/${signature}?cluster=devnet` });
  } catch (err) {
    console.error("anchor-contribution error:", err);
    return respond(500, { error: err instanceof Error ? err.message : "Unknown error" });
  }
});
