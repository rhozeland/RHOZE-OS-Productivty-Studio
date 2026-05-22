// Records a fan-claimed attendance for a creator's Luma event and anchors the
// attestation on Solana via a memo TX. Honor-system in phase 1 (no Luma RSVP
// verification). Idempotent on (user_id, luma_url).
import { createClient } from "npm:@supabase/supabase-js@2";

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

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
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
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return respond(401, { error: "Unauthorized" });

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return respond(400, { error: "Invalid JSON" }); }
    const profile_id = body.profile_id as string | undefined;
    const luma_url = (body.luma_url as string | undefined)?.trim();
    if (!profile_id || !luma_url) return respond(400, { error: "profile_id and luma_url required" });
    if (!/^https?:\/\/(www\.)?lu\.ma\//i.test(luma_url)) {
      return respond(400, { error: "luma_url must be a lu.ma URL" });
    }
    if (profile_id === user.id) {
      // Defensive — but the real guard is: claimer must not be the creator.
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify profile exists + the user isn't claiming on their own profile.
    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("id, user_id, display_name")
      .eq("id", profile_id)
      .maybeSingle();
    if (pErr || !profile) return respond(404, { error: "Profile not found" });
    if (profile.user_id === user.id) {
      return respond(403, { error: "You can't claim attendance on your own event" });
    }

    // Idempotent insert. If a row already exists with a signature, return it.
    const { data: existing } = await admin
      .from("event_attendance_claims")
      .select("id, memo_signature, anchored_at")
      .eq("user_id", user.id)
      .eq("luma_url", luma_url)
      .maybeSingle();

    let claimId: string;
    if (existing) {
      if (existing.memo_signature) {
        return respond(200, {
          claim_id: existing.id,
          signature: existing.memo_signature,
          explorer: `https://solscan.io/tx/${existing.memo_signature}`,
          already_anchored: true,
        });
      }
      claimId = existing.id;
    } else {
      const { data: inserted, error: iErr } = await admin
        .from("event_attendance_claims")
        .insert({ user_id: user.id, profile_id, luma_url })
        .select("id")
        .single();
      if (iErr || !inserted) return respond(500, { error: "Failed to record claim" });
      claimId = inserted.id;
    }

    // Build attendance hash + contribution proof.
    const payload = {
      protocol: "rhozeland",
      type: "luma_attendance",
      claim_id: claimId,
      attendee: user.id,
      profile_id,
      luma_url,
      claimed_at: new Date().toISOString(),
    };
    const attendance_hash = await sha256Hex(JSON.stringify(payload));

    await admin.from("contribution_proofs").insert({
      user_id: user.id,
      action_type: "event_attendance",
      reference_id: claimId,
      metadata: { ...payload, attendance_hash, source: "luma_self_claim" },
    });

    const privateKeyStr = Deno.env.get("RHOZE_AIRDROP_PRIVATE_KEY");
    if (!privateKeyStr) {
      return respond(200, {
        claim_id: claimId,
        pending: true,
        reason: "Treasury wallet not configured — claim recorded, anchor will retry.",
      });
    }

    try {
      const { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, clusterApiUrl } =
        await import("npm:@solana/web3.js@1.98.0");
      const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
      const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(privateKeyStr)));
      const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

      const memo = JSON.stringify({
        protocol: "rhozeland",
        version: "1",
        type: "luma_attendance",
        claim_id: claimId,
        attendance_hash,
        ts: new Date().toISOString(),
      });

      const ix = new TransactionInstruction({
        keys: [{ pubkey: keypair.publicKey, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: new TextEncoder().encode(memo),
      });
      const tx = new Transaction().add(ix);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      tx.feePayer = keypair.publicKey;
      tx.sign(keypair);
      const signature = await connection.sendRawTransaction(tx.serialize());

      const anchored_at = new Date().toISOString();
      await admin
        .from("event_attendance_claims")
        .update({ memo_signature: signature, anchored_at, anchor_last_error: null })
        .eq("id", claimId);

      return respond(200, {
        claim_id: claimId,
        signature,
        explorer: `https://solscan.io/tx/${signature}`,
      });
    } catch (anchorErr) {
      const msg = anchorErr instanceof Error ? anchorErr.message : "Unknown anchor error";
      await admin
        .from("event_attendance_claims")
        .update({ anchor_last_error: msg.slice(0, 500) })
        .eq("id", claimId);
      return respond(202, { claim_id: claimId, pending: true, error: msg });
    }
  } catch (err) {
    console.error("claim-event-attendance error:", err);
    return respond(500, { error: err instanceof Error ? err.message : "Unknown error" });
  }
});
