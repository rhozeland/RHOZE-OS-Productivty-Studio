/**
 * anchor-roadmap — write a public Solana memo when a project roadmap is locked.
 *
 * Memo payload includes contract id, parties, total credits, payment method,
 * and (if configured) the revenue split percentages. This makes the agreement
 * publicly verifiable on-chain via Solscan, even before the full Anchor program
 * ships.
 *
 * Mirrors the dynamic-import / lightweight pattern of anchor-contribution.
 */
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

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) return respond(401, { error: "Unauthorized" });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return respond(400, { error: "Invalid JSON body" });
    }

    const contract_id = body.contract_id as string | undefined;
    if (!contract_id) return respond(400, { error: "contract_id required" });

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify contract exists and the caller is a party to it.
    const { data: contract, error: contractErr } = await adminClient
      .from("project_contracts")
      .select("id, project_id, client_id, specialist_id, total_credits, status, notes")
      .eq("id", contract_id)
      .single();

    if (contractErr || !contract) {
      return respond(404, { error: "Contract not found" });
    }
    if (contract.client_id !== user.id && contract.specialist_id !== user.id) {
      return respond(403, { error: "Not a party to this contract" });
    }

    // Splits v2: load the locked split + collaborator pcts so the memo
    // carries the canonical fingerprint, not the legacy creator/curator/buyback shape.
    const { data: split } = await adminClient
      .from("revenue_split_configs")
      .select("id, locked_platform_fee_bps, splits_hash")
      .eq("contract_id", contract_id)
      .eq("is_active", true)
      .maybeSingle();

    let collaborators: Array<{ user_id: string; pct: number }> = [];
    if (split?.id) {
      const { data: rows } = await adminClient
        .from("revenue_split_collaborators")
        .select("user_id, pct")
        .eq("config_id", split.id);
      collaborators = (rows ?? []).map((r) => ({
        user_id: r.user_id,
        pct: Number(r.pct),
      }));
    }

    // Build the public memo.
    const memo = JSON.stringify({
      protocol: "rhozeland",
      version: "2",
      type: "roadmap_lock",
      contract: contract.id.slice(0, 8),
      project: contract.project_id.slice(0, 8),
      client: contract.client_id.slice(0, 8),
      specialist: contract.specialist_id.slice(0, 8),
      total: Number(contract.total_credits),
      splits_hash: split?.splits_hash ?? null,
      platform_bps: split?.locked_platform_fee_bps ?? null,
      collaborators: collaborators.length
        ? collaborators.map((c) => ({ u: c.user_id.slice(0, 8), p: c.pct }))
        : null,
      ts: new Date().toISOString(),
    });

    const privateKeyStr = Deno.env.get("RHOZE_AIRDROP_PRIVATE_KEY");
    if (!privateKeyStr) {
      return respond(500, { error: "Anchor wallet not configured" });
    }

    // Dynamic import — keeps cold starts safe.
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
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = keypair.publicKey;
    transaction.sign(keypair);

    const signature = await connection.sendRawTransaction(transaction.serialize());

    // Record as a contribution proof so it appears in the user's anchor history.
    await adminClient.from("contribution_proofs").insert({
      user_id: user.id,
      action_type: "roadmap_lock",
      reference_id: contract_id,
      solana_signature: signature,
      anchored_at: new Date().toISOString(),
      metadata: { contract_id, total: Number(contract.total_credits) },
    });

    return respond(200, {
      signature,
      explorer: `https://solscan.io/tx/${signature}`,
    });
  } catch (err) {
    console.error("anchor-roadmap error:", err);
    return respond(500, {
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
