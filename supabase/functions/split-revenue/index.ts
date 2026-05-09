// Splits v2 — payout collaborators + platform fee.
//
// Requires the split config to be locked (locked_at + locked_platform_fee_bps).
// 1. Verify caller is a party to the contract + the milestone is approved.
// 2. Compute platform fee from locked_platform_fee_bps.
// 3. Distribute the remainder to every collaborator by their locked %.
// 4. Memo the canonical payload on Solana (best-effort).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResp(401, { error: "No auth" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonResp(401, { error: "Unauthorized" });

    const { config_id, purchase_id } = await req.json();
    if (!config_id || !purchase_id) {
      return jsonResp(400, { error: "config_id and purchase_id required" });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load config + collaborators.
    const { data: config } = await admin
      .from("revenue_split_configs")
      .select("*")
      .eq("id", config_id)
      .eq("is_active", true)
      .single();
    if (!config) return jsonResp(404, { error: "Split config not found" });

    if (!config.locked_at || !config.locked_platform_fee_bps) {
      return jsonResp(400, {
        error: "Splits must be locked before payout. Lock the project first.",
      });
    }

    // Verify milestone + contract ownership.
    const { data: milestone } = await admin
      .from("project_milestones")
      .select("id, contract_id, credit_amount, status")
      .eq("id", purchase_id)
      .maybeSingle();
    if (!milestone) return jsonResp(404, { error: "Milestone not found" });
    if (milestone.contract_id !== config.contract_id) {
      return jsonResp(403, { error: "Milestone/config mismatch" });
    }
    if (milestone.status !== "approved" && milestone.status !== "released") {
      return jsonResp(400, { error: "Milestone not approved" });
    }
    const { data: contract } = await admin
      .from("project_contracts")
      .select("client_id, specialist_id")
      .eq("id", milestone.contract_id)
      .maybeSingle();
    if (!contract || (contract.client_id !== user.id && contract.specialist_id !== user.id)) {
      return jsonResp(403, { error: "Not authorized for this contract" });
    }

    const total_amount = Number(milestone.credit_amount);
    if (!total_amount || total_amount <= 0) {
      return jsonResp(400, { error: "Invalid milestone amount" });
    }

    // Platform fee off the top.
    const platformBps = Number(config.locked_platform_fee_bps);
    const platformAmount = Math.floor((total_amount * platformBps) / 10000);
    const pool = total_amount - platformAmount;

    // Load collaborators.
    const { data: collaborators } = await admin
      .from("revenue_split_collaborators")
      .select("user_id, pct")
      .eq("config_id", config_id);
    if (!collaborators?.length) {
      return jsonResp(400, { error: "No collaborators on this split" });
    }

    // Distribute. Rounding dust → lead.
    const splits: Array<{ user_id: string; amount: number; pct: number }> = [];
    let distributed = 0;
    for (const c of collaborators) {
      const amount = Math.floor((pool * Number(c.pct)) / 100);
      splits.push({ user_id: c.user_id, amount, pct: Number(c.pct) });
      distributed += amount;
    }
    const dust = pool - distributed;
    if (dust !== 0) {
      const leadIdx = splits.findIndex((s) => s.user_id === config.creator_id);
      if (leadIdx >= 0) splits[leadIdx].amount += dust;
      else splits[0].amount += dust;
    }

    // Award credits.
    for (const s of splits) {
      if (s.amount <= 0) continue;
      await admin.rpc("award_rhoze", {
        _user_id: s.user_id,
        _amount: s.amount,
        _description: `Revenue split: ${s.pct}% of ${total_amount} credits`,
      });
    }

    // Memo on Solana (best-effort).
    let solana_signature: string | null = null;
    try {
      const privateKeyStr = Deno.env.get("RHOZE_AIRDROP_PRIVATE_KEY");
      if (privateKeyStr) {
        const memo = JSON.stringify({
          protocol: "rhozeland",
          version: "2",
          type: "split_payout",
          config_id,
          milestone: purchase_id.slice(0, 8),
          splits_hash: config.splits_hash,
          platform_bps: platformBps,
          total: total_amount,
          platform_amount: platformAmount,
          ts: new Date().toISOString(),
        });
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
        const kp = Keypair.fromSecretKey(new Uint8Array(JSON.parse(privateKeyStr)));
        const conn = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");
        const tx = new Transaction().add(
          new TransactionInstruction({
            keys: [{ pubkey: kp.publicKey, isSigner: true, isWritable: false }],
            programId: MEMO_PROGRAM_ID,
            data: new TextEncoder().encode(memo),
          }),
        );
        const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        tx.feePayer = kp.publicKey;
        tx.sign(kp);
        solana_signature = await conn.sendRawTransaction(tx.serialize());
      }
    } catch (err) {
      console.error("Memo anchor failed:", err instanceof Error ? err.message : err);
    }

    // Log + back-compat fields for existing dashboards.
    await admin.from("revenue_split_logs").insert({
      config_id,
      purchase_id,
      total_amount,
      platform_amount: platformAmount,
      platform_fee_bps: platformBps,
      splits_hash: config.splits_hash,
      splits: splits.map((s) => ({ user_id: s.user_id, amount: s.amount, pct: s.pct })),
      creator_amount: splits.find((s) => s.user_id === config.creator_id)?.amount ?? 0,
      curator_amount: 0,
      buyback_amount: 0,
      solana_signature,
    });

    // Notify each collaborator.
    const notifications = splits
      .filter((s) => s.amount > 0)
      .map((s) => ({
        user_id: s.user_id,
        type: "purchase",
        title: `+${s.amount} $RHOZE released`,
        body: `Your ${s.pct}% share of a ${total_amount}-credit milestone just landed.`,
        link: "/seller-dashboard",
      }));
    if (notifications.length) {
      await admin.from("notifications").insert(notifications);
    }

    return jsonResp(200, {
      success: true,
      total: total_amount,
      platform_amount: platformAmount,
      platform_bps: platformBps,
      splits,
      solana_signature,
    });
  } catch (err) {
    return jsonResp(500, { error: err instanceof Error ? err.message : String(err) });
  }
});

function jsonResp(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
