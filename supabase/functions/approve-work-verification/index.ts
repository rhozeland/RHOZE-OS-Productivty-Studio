// Atomically anchor a Work on Solana and mark a verification request approved.
// Called by an admin from the IP Verifications dashboard.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond(401, { error: "No auth" });

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return respond(401, { error: "Unauthorized" });

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify admin role
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return respond(403, { error: "Admin role required" });

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return respond(400, { error: "Invalid JSON" }); }
    const request_id = body.request_id as string | undefined;
    const review_note = (body.review_note as string | undefined) ?? null;
    if (!request_id) return respond(400, { error: "request_id required" });

    // Load request + work
    const { data: vreq, error: vreqErr } = await adminClient
      .from("work_verification_requests")
      .select("id, work_id, applicant_id, status")
      .eq("id", request_id)
      .single();
    if (vreqErr || !vreq) return respond(404, { error: "Request not found" });
    if (!["pending", "changes_requested"].includes(vreq.status))
      return respond(400, { error: "Request is not open" });

    const { data: work } = await adminClient
      .from("works")
      .select("id, user_id, content_hash, kind, title")
      .eq("id", vreq.work_id)
      .single();
    if (!work) return respond(404, { error: "Work not found" });

    // Build memo + sign on Solana
    const privateKeyStr = Deno.env.get("RHOZE_AIRDROP_PRIVATE_KEY");
    if (!privateKeyStr) return respond(500, { error: "Anchor wallet not configured" });

    const memo = JSON.stringify({
      protocol: "rhozeland",
      version: "1",
      type: "work_verification",
      work_id: work.id,
      hash: work.content_hash,
      kind: work.kind,
      creator: work.user_id,
      reviewer: userData.user.id,
      ts: new Date().toISOString(),
    });

    const {
      Connection, Keypair, PublicKey, Transaction,
      TransactionInstruction, clusterApiUrl,
    } = await import("npm:@solana/web3.js@1.98.0");

    const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
    const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(privateKeyStr)));
    const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

    const memoInstruction = new TransactionInstruction({
      keys: [{ pubkey: keypair.publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: new TextEncoder().encode(memo),
    });

    const tx = new Transaction().add(memoInstruction);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = keypair.publicKey;
    tx.sign(keypair);

    const signature = await connection.sendRawTransaction(tx.serialize());

    // Mark approved (the RPC writes the signature onto the work + flow_items)
    // We call the RPC as the admin user so reviewer_id is captured.
    const { error: rpcErr } = await userClient.rpc("approve_work_verification", {
      _request_id: request_id,
      _solana_signature: signature,
      _review_note: review_note,
    });
    if (rpcErr) return respond(500, { error: rpcErr.message, signature });

    return respond(200, {
      signature,
      explorer: `https://solscan.io/tx/${signature}`,
    });
  } catch (err) {
    console.error("approve-work-verification error:", err);
    return respond(500, {
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
