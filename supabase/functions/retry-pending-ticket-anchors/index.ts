// Nightly sweep: re-anchors any checked-in event tickets that are still
// missing a Solana signature. Authorized via service role key in the body
// (cron job sends the anon key + service role secret header below) OR via
// CRON_SECRET header.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Allow either service role or a configured CRON_SECRET.
    const cronSecret = Deno.env.get("CRON_SECRET");
    const headerSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ok =
      (cronSecret && headerSecret === cronSecret) ||
      authHeader === `Bearer ${serviceKey}`;
    if (!ok) return respond(401, { error: "Unauthorized" });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    // Pick up to 25 pending tickets older than 2 minutes since last attempt
    // (or never attempted). Cap retries at 8.
    const { data: pending, error: qErr } = await admin
      .from("event_tickets")
      .select(
        "id, event_id, holder_id, qr_token, attendance_hash, anchor_proof_id, anchor_attempts, checked_in_at",
      )
      .eq("status", "checked_in")
      .is("solana_signature", null)
      .lt("anchor_attempts", 8)
      .or(
        `anchor_last_attempt_at.is.null,anchor_last_attempt_at.lt.${new Date(Date.now() - 2 * 60 * 1000).toISOString()}`,
      )
      .order("anchor_last_attempt_at", { ascending: true, nullsFirst: true })
      .limit(25);
    if (qErr) return respond(500, { error: qErr.message });

    if (!pending || pending.length === 0) {
      return respond(200, { processed: 0, succeeded: 0, failed: 0 });
    }

    const privateKeyStr = Deno.env.get("RHOZE_AIRDROP_PRIVATE_KEY");
    if (!privateKeyStr) {
      return respond(500, { error: "Treasury wallet not configured" });
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
    const keypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(privateKeyStr)),
    );
    const connection = new Connection(
      clusterApiUrl("mainnet-beta"),
      "confirmed",
    );

    let succeeded = 0;
    let failed = 0;

    for (const t of pending) {
      try {
        const { data: ev } = await admin
          .from("events")
          .select("id, creator_id, manifest_hash")
          .eq("id", t.event_id)
          .single();
        if (!ev) throw new Error("Event missing");

        const payload = {
          protocol: "rhozeland",
          type: "attendance",
          ticket_id: t.id,
          event_id: t.event_id,
          holder_id: t.holder_id,
          host_id: ev.creator_id,
          qr_token: t.qr_token,
          event_manifest_hash: ev.manifest_hash ?? null,
          checked_in_at: t.checked_in_at,
        };
        let attendance_hash = t.attendance_hash as string | null;
        if (!attendance_hash) {
          attendance_hash = await sha256Hex(JSON.stringify(payload));
          await admin
            .from("event_tickets")
            .update({ attendance_hash })
            .eq("id", t.id);
        }

        let proofId = t.anchor_proof_id as string | null;
        if (!proofId) {
          const { data: proof } = await admin
            .from("contribution_proofs")
            .insert({
              user_id: t.holder_id,
              action_type: "event_attendance",
              reference_id: t.id,
              metadata: { ...payload, attendance_hash },
            })
            .select("id")
            .single();
          if (!proof) throw new Error("Proof insert failed");
          proofId = proof.id;
          await admin
            .from("event_tickets")
            .update({ anchor_proof_id: proofId })
            .eq("id", t.id);
        }

        const memo = JSON.stringify({
          protocol: "rhozeland",
          version: "1",
          type: "attendance",
          ticket_id: t.id,
          event_id: t.event_id,
          proof_id: proofId,
          attendance_hash,
          ts: new Date().toISOString(),
        });
        const ix = new TransactionInstruction({
          keys: [
            { pubkey: keypair.publicKey, isSigner: true, isWritable: false },
          ],
          programId: MEMO_PROGRAM_ID,
          data: new TextEncoder().encode(memo),
        });
        const tx = new Transaction().add(ix);
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        tx.feePayer = keypair.publicKey;
        tx.sign(keypair);
        const signature = await connection.sendRawTransaction(tx.serialize());

        const anchored_at = new Date().toISOString();
        await admin
          .from("event_tickets")
          .update({
            solana_signature: signature,
            anchored_at,
            anchor_last_attempt_at: anchored_at,
            anchor_last_error: null,
          })
          .eq("id", t.id);
        await admin
          .from("contribution_proofs")
          .update({ solana_signature: signature, anchored_at })
          .eq("id", proofId);

        succeeded++;
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : "Unknown error";
        await admin
          .from("event_tickets")
          .update({
            anchor_attempts: ((t as any).anchor_attempts ?? 0) + 1,
            anchor_last_attempt_at: new Date().toISOString(),
            anchor_last_error: msg.slice(0, 500),
          })
          .eq("id", t.id);
      }
    }

    return respond(200, {
      processed: pending.length,
      succeeded,
      failed,
    });
  } catch (err) {
    console.error("retry-pending-ticket-anchors error:", err);
    return respond(500, {
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
