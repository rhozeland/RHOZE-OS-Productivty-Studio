// Anchor a single event ticket's proof-of-attendance on Solana.
// Idempotent + retry-safe. Callable by:
//   - the ticket holder (retrying their own pending receipt)
//   - the event host (any ticket on their event)
// Fees paid by the Rhozeland treasury wallet (RHOZE_AIRDROP_PRIVATE_KEY).

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
    const ticket_id = body.ticket_id as string | undefined;
    if (!ticket_id) return respond(400, { error: "ticket_id required" });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: ticket, error: tErr } = await admin
      .from("event_tickets")
      .select(
        "id, event_id, holder_id, qr_token, status, attendance_hash, solana_signature, anchor_proof_id, checked_in_at",
      )
      .eq("id", ticket_id)
      .single();
    if (tErr || !ticket) return respond(404, { error: "Ticket not found" });

    // Authorization: holder OR event host.
    const { data: ev } = await admin
      .from("events")
      .select("id, creator_id, manifest_hash")
      .eq("id", ticket.event_id)
      .maybeSingle();
    if (!ev) {
      // Event was deleted — can't anchor, but don't surface as a hard error.
      // Stop the retry loop by flagging it on the ticket.
      await admin
        .from("event_tickets")
        .update({
          anchor_attempts: 99,
          anchor_last_attempt_at: new Date().toISOString(),
          anchor_last_error: "Event no longer exists",
        })
        .eq("id", ticket.id);
      return respond(200, { skipped: true, reason: "event_missing" });
    }

    const isHolder = ticket.holder_id === user.id;
    const isHost = ev.creator_id === user.id;
    if (!isHolder && !isHost) return respond(403, { error: "Forbidden" });

    if (ticket.solana_signature) {
      return respond(200, {
        signature: ticket.solana_signature,
        explorer: `https://solscan.io/tx/${ticket.solana_signature}`,
        already_anchored: true,
      });
    }
    if (ticket.status !== "checked_in") {
      return respond(409, { error: "Ticket not checked in yet" });
    }

    // Ensure attendance_hash exists (recompute if missing).
    let attendance_hash = ticket.attendance_hash;
    const payload = {
      protocol: "rhozeland",
      type: "attendance",
      ticket_id: ticket.id,
      event_id: ticket.event_id,
      holder_id: ticket.holder_id,
      host_id: ev.creator_id,
      qr_token: ticket.qr_token,
      event_manifest_hash: ev.manifest_hash ?? null,
      checked_in_at: ticket.checked_in_at,
    };
    if (!attendance_hash) {
      attendance_hash = await sha256Hex(JSON.stringify(payload));
      await admin
        .from("event_tickets")
        .update({ attendance_hash })
        .eq("id", ticket.id);
    }

    // Ensure a contribution_proofs row exists (idempotent).
    let proofId = ticket.anchor_proof_id as string | null;
    if (!proofId) {
      const { data: proof, error: pErr } = await admin
        .from("contribution_proofs")
        .insert({
          user_id: ticket.holder_id,
          action_type: "event_attendance",
          reference_id: ticket.id,
          metadata: { ...payload, attendance_hash },
        })
        .select("id")
        .single();
      if (pErr || !proof) {
        return respond(500, { error: "Failed to create proof row" });
      }
      proofId = proof.id;
      await admin
        .from("event_tickets")
        .update({ anchor_proof_id: proofId })
        .eq("id", ticket.id);
    }

    const privateKeyStr = Deno.env.get("RHOZE_AIRDROP_PRIVATE_KEY");
    if (!privateKeyStr) {
      return respond(500, { error: "Treasury wallet not configured" });
    }

    try {
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

      const memo = JSON.stringify({
        protocol: "rhozeland",
        version: "1",
        type: "attendance",
        ticket_id: ticket.id,
        event_id: ticket.event_id,
        proof_id: proofId,
        attendance_hash,
        ts: new Date().toISOString(),
      });

      const ix = new TransactionInstruction({
        keys: [{ pubkey: keypair.publicKey, isSigner: true, isWritable: false }],
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
        .eq("id", ticket.id);
      await admin
        .from("contribution_proofs")
        .update({ solana_signature: signature, anchored_at })
        .eq("id", proofId);

      return respond(200, {
        signature,
        explorer: `https://solscan.io/tx/${signature}`,
      });
    } catch (anchorErr) {
      const msg =
        anchorErr instanceof Error ? anchorErr.message : "Unknown anchor error";
      await admin
        .from("event_tickets")
        .update({
          anchor_attempts: ((ticket as any).anchor_attempts ?? 0) + 1,
          anchor_last_attempt_at: new Date().toISOString(),
          anchor_last_error: msg.slice(0, 500),
        })
        .eq("id", ticket.id);
      return respond(502, { error: msg, pending: true });
    }
  } catch (err) {
    console.error("anchor-event-ticket error:", err);
    return respond(500, {
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
