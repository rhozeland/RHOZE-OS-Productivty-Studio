// Mints a short-lived signed URL for a token-gated Work, but only after
// re-running the gating check server-side. Two pool types:
//
//   pool_type = "launch"     → defers to request_work_unlock RPC (simulated
//                              bonding-curve holdings).
//   pool_type = "rhoze_pool" → reads the caller's live $RHOZE wallet balance
//                              from Solana mainnet and gates on min_tokens.
//                              Wallet comes from profiles.wallet_address (the
//                              one bound at first connect).
//
// Either way the signed URL is minted with the service role so the bucket can
// stay strictly owner-only on direct reads.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const RHOZE_MINT = "7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump";
const RHOZE_DECIMALS = 6;
const RPC_URL = "https://api.mainnet-beta.solana.com";

async function rpcCall(method: string, params: unknown[]) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return await res.json();
}

async function getRhozeBalance(wallet: string): Promise<number> {
  const result = await rpcCall("getTokenAccountsByOwner", [
    wallet,
    { mint: RHOZE_MINT },
    { encoding: "jsonParsed" },
  ]);
  const accounts = result?.result?.value ?? [];
  let total = 0;
  for (const a of accounts) {
    const amt = a?.account?.data?.parsed?.info?.tokenAmount?.amount;
    if (amt) total += Number(amt);
  }
  return total / Math.pow(10, RHOZE_DECIMALS);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      token,
    );
    if (claimsErr || !claims?.claims?.sub) {
      return json(401, { error: "Unauthorized" });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const workId: string | undefined = body?.work_id;
    if (!workId || typeof workId !== "string") {
      return json(400, { error: "work_id required" });
    }

    const adminClient = createClient(url, service);

    // Read the work + its gating shape with service role so we can branch
    // before deciding which gate to run.
    const { data: work, error: workErr } = await adminClient
      .from("works")
      .select("id, user_id, gating")
      .eq("id", workId)
      .maybeSingle();
    if (workErr) return json(500, { error: workErr.message });
    if (!work) return json(200, { allowed: false, reason: "not_found" });

    const gating = (work.gating ?? {}) as {
      enabled?: boolean;
      pool_type?: "launch" | "rhoze_pool" | "backer";
      launch_id?: string | null;
      min_tokens?: number;
      gated_path?: string;
    };
    if (!gating.enabled || !gating.gated_path) {
      return json(200, { allowed: false, reason: "not_gated" });
    }

    const isOwner = work.user_id === userId;
    let poolType = gating.pool_type ?? "launch";

    // BACKER branch — resolve to creator's active profile coin and fall
    // through to the standard launch gating path.
    if (poolType === "backer") {
      if (isOwner) {
        // Owner short-circuit handled below by request_work_unlock path.
        poolType = "launch";
      } else {
        const { data: launch } = await adminClient
          .from("coin_launches")
          .select("id")
          .eq("creator_id", work.user_id)
          .neq("status", "cancelled")
          .order("work_id", { ascending: true, nullsFirst: true })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!launch) {
          return json(200, {
            allowed: false,
            reason: "backing_not_open",
            balance: 0,
            threshold: Number(gating.min_tokens ?? 1),
            ticker: null,
            launch_id: null,
          });
        }
        // Rewrite gating in-memory so the launch branch below uses this id.
        gating.launch_id = launch.id;
        poolType = "launch";
      }
    }

    // Branch: $RHOZE-pool gating reads live wallet balance server-side.
    if (poolType === "rhoze_pool") {
      const threshold = Number(gating.min_tokens ?? 0);
      let balance = 0;
      let walletAddress: string | null = null;

      if (!isOwner) {
        const { data: profile } = await adminClient
          .from("profiles")
          .select("wallet_address")
          .eq("user_id", userId)
          .maybeSingle();
        walletAddress = profile?.wallet_address ?? null;
        if (!walletAddress) {
          return json(200, {
            allowed: false,
            reason: "insufficient_holdings",
            balance: 0,
            threshold,
            ticker: "RHOZE",
            launch_id: null,
          });
        }
        balance = await getRhozeBalance(walletAddress);
        if (balance < threshold) {
          return json(200, {
            allowed: false,
            reason: "insufficient_holdings",
            balance,
            threshold,
            ticker: "RHOZE",
            launch_id: null,
          });
        }
      }

      const { data: signed, error: signErr } = await adminClient.storage
        .from("gated-works")
        .createSignedUrl(gating.gated_path, 300);
      if (signErr || !signed?.signedUrl) {
        return json(500, { error: signErr?.message ?? "Could not sign URL" });
      }
      return json(200, {
        allowed: true,
        signed_url: signed.signedUrl,
        balance,
        threshold,
        ticker: "RHOZE",
        is_owner: isOwner,
      });
    }

    // Default branch: launch-coin gating uses the existing RPC (simulated
    // bonding-curve holdings via coin_trades).
    const { data: gateResult, error: gateErr } = await userClient.rpc(
      "request_work_unlock",
      { _work_id: workId },
    );
    if (gateErr) return json(500, { error: gateErr.message });
    const gate = gateResult as Record<string, unknown> | null;
    if (!gate || gate.allowed !== true) {
      return json(200, gate ?? { allowed: false, reason: "unknown" });
    }

    const gatedPath = gate.gated_path as string | undefined;
    if (!gatedPath) return json(500, { error: "Missing gated_path" });

    const { data: signed, error: signErr } = await adminClient.storage
      .from("gated-works")
      .createSignedUrl(gatedPath, 300);
    if (signErr || !signed?.signedUrl) {
      return json(500, { error: signErr?.message ?? "Could not sign URL" });
    }

    return json(200, {
      allowed: true,
      signed_url: signed.signedUrl,
      balance: gate.balance ?? 0,
      threshold: gate.threshold ?? 0,
      ticker: gate.ticker ?? null,
      is_owner: gate.is_owner ?? false,
    });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Unknown" });
  }
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
