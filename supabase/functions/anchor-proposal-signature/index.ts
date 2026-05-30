// anchor-proposal-signature — Wave 2
//
// Posts a Solana memo containing the SHA-256 hash of a project_proposals
// snapshot (the canonical agreement) for the calling user's side, then
// records the resulting tx signature back onto the proposal row via the
// service-only RPC `record_proposal_signature_anchor`.
//
// Auth: requires a logged-in user who is a party to the proposal AND has
// already signed (off-chain) — i.e. their `<side>_signature_hash` is set.
//
// Network: mainnet-beta (same wallet/cluster as anchor-contribution).
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond(401, { error: "No auth" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return respond(401, { error: "Unauthorized" });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return respond(400, { error: "Invalid JSON body" });
    }

    const proposal_id = body.proposal_id as string | undefined;
    if (!proposal_id) return respond(400, { error: "proposal_id required" });

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: proposal, error: proposalError } = await adminClient
      .from("project_proposals")
      .select("*")
      .eq("id", proposal_id)
      .maybeSingle();

    if (proposalError || !proposal) {
      return respond(404, { error: "Proposal not found" });
    }

    // Caller must be a party.
    const isClient = user.id === proposal.client_id;
    const isSpecialist = user.id === proposal.specialist_id;
    if (!isClient && !isSpecialist) {
      return respond(403, { error: "Not a party to this proposal" });
    }

    const side: "client" | "specialist" = isClient ? "client" : "specialist";
    const signatureHash: string | null =
      side === "client" ? proposal.client_signature_hash : proposal.specialist_signature_hash;
    const existingTx: string | null =
      side === "client" ? proposal.client_signature_tx : proposal.specialist_signature_tx;

    if (!signatureHash) {
      return respond(400, { error: "You haven't signed this proposal yet" });
    }
    if (existingTx) {
      // Idempotent — return what we already anchored.
      return respond(200, {
        signature: existingTx,
        explorer: `https://solscan.io/tx/${existingTx}`,
        side,
        already_anchored: true,
      });
    }

    const memo = JSON.stringify({
      protocol: "rhozeland",
      version: "1",
      type: "proposal_signature",
      proposal_id,
      side,
      hash: signatureHash,
      terms_version: proposal.terms_version,
      signer: user.id,
      ts: new Date().toISOString(),
    });

    const privateKeyStr = Deno.env.get("RHOZE_AIRDROP_PRIVATE_KEY");
    if (!privateKeyStr) {
      return respond(500, { error: "Anchor wallet not configured" });
    }

    const {
      Connection,
      Keypair,
      PublicKey,
      Transaction,
      TransactionInstruction,
      clusterApiUrl,
    } = await import("npm:@solana/web3.js@1.98.0");

    const MEMO_PROGRAM_ID = new PublicKey(
      "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
    );

    const privateKeyArray = JSON.parse(privateKeyStr);
    const keypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
    const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

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

    await adminClient.rpc("record_proposal_signature_anchor", {
      _proposal_id: proposal_id,
      _side: side,
      _tx_signature: signature,
    });

    return respond(200, {
      signature,
      explorer: `https://solscan.io/tx/${signature}`,
      side,
      hash: signatureHash,
    });
  } catch (err) {
    console.error("anchor-proposal-signature error:", err);
    return respond(500, {
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
