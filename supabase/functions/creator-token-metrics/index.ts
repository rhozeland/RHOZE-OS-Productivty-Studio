/**
 * creator-token-metrics — server-side proxy for pump.fun + Birdeye public APIs.
 *
 * Browsers can't hit `frontend-api-v3.pump.fun` or `public-api.birdeye.so`
 * reliably (intermittent CORS + WAF blocks). This edge function fetches both
 * server-side, merges them, and returns a single normalized payload that
 * `useCreatorTokenMetrics` consumes. No auth required — coin data is public.
 */
// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : null;
};

async function fetchPumpFun(mint: string) {
  try {
    const res = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; Rhozeland/1.0)" },
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    return {
      marketCapUsd: num(j?.usd_market_cap),
      athMarketCapUsd: num(j?.ath_market_cap ?? j?.market_cap_ath),
      holderCount: num(j?.num_holders ?? j?.holder_count),
      creatorWallet: typeof j?.creator === "string" ? j.creator : null,
      volumeUsd: num(j?.usd_volume ?? j?.volume_usd),
      name: typeof j?.name === "string" ? j.name : null,
      symbol: typeof j?.symbol === "string" ? j.symbol : null,
      imageUri: typeof j?.image_uri === "string" ? j.image_uri : null,
      createdTimestamp: num(j?.created_timestamp),
      lastTradeTimestamp: num(j?.last_trade_timestamp),
      trades24h: num(j?.trades_24h ?? j?.txns_24h),
      priceChange24hPump: num(j?.price_change_24h ?? j?.priceChange24h),
      virtualSolReserves: num(j?.virtual_sol_reserves),
      virtualTokenReserves: num(j?.virtual_token_reserves),
    };
  } catch {
    return null;
  }
}

async function fetchPumpHolders(mint: string): Promise<number | null> {
  try {
    const res = await fetch(`https://frontend-api-v3.pump.fun/coins/holders/${mint}`, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; Rhozeland/1.0)" },
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    const arr = Array.isArray(j?.holders) ? j.holders : Array.isArray(j) ? j : [];
    return arr.length || null;
  } catch {
    return null;
  }
}

async function fetchBirdeyePrice(mint: string) {
  try {
    const res = await fetch(
      `https://public-api.birdeye.so/defi/price?address=${mint}&include_liquidity=false`,
      { headers: { "x-chain": "solana", accept: "application/json" } },
    );
    if (!res.ok) return null;
    const j: any = await res.json();
    const v = j?.data;
    return {
      priceUsd: num(v?.value),
      change24h: num(v?.priceChange24h),
    };
  } catch {
    return null;
  }
}

async function fetchSparkline(mint: string): Promise<number[]> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 60 * 60 * 24 * 7;
    const res = await fetch(
      `https://public-api.birdeye.so/defi/history_price?address=${mint}&address_type=token&type=4H&time_from=${from}&time_to=${now}`,
      { headers: { "x-chain": "solana", accept: "application/json" } },
    );
    if (!res.ok) return [];
    const j: any = await res.json();
    const items: any[] = j?.data?.items ?? [];
    return items.map((it) => Number(it?.value)).filter((n) => Number.isFinite(n));
  } catch {
    return [];
  }
}

async function fetchJupiterPrice(mint: string) {
  try {
    const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mint}`);
    if (!res.ok) return null;
    const j: any = await res.json();
    return { priceUsd: num(j?.[mint]?.usdPrice) };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const mint = url.searchParams.get("mint");
  if (!mint || mint.length < 32 || mint.length > 64) {
    return new Response(JSON.stringify({ error: "missing or invalid mint" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const [pump, birdeye, sparkline] = await Promise.all([
    fetchPumpFun(mint),
    fetchBirdeyePrice(mint),
    fetchSparkline(mint),
  ]);

  let priceUsd = birdeye?.priceUsd ?? null;
  if (priceUsd == null) {
    const jup = await fetchJupiterPrice(mint);
    priceUsd = jup?.priceUsd ?? null;
  }

  // pump.fun /coins often returns num_holders=null. Backfill from /coins/holders.
  let holderCount = pump?.holderCount ?? null;
  if (holderCount == null) {
    holderCount = await fetchPumpHolders(mint);
  }

  const mc = pump?.marketCapUsd ?? null;
  const ath = pump?.athMarketCapUsd ?? null;
  const athChangePct = mc != null && ath != null && ath > 0 ? ((mc - ath) / ath) * 100 : null;

  const sources: string[] = [];
  if (pump) sources.push("pump.fun");
  if (birdeye) sources.push("Birdeye");

  const payload = {
    priceUsd,
    change24h: birdeye?.change24h ?? pump?.priceChange24hPump ?? null,
    marketCapUsd: mc,
    athMarketCapUsd: ath,
    athChangePct,
    holderCount,
    volumeUsd: pump?.volumeUsd ?? null,
    creatorWallet: pump?.creatorWallet ?? null,
    sparkline7d: sparkline,
    name: pump?.name ?? null,
    symbol: pump?.symbol ?? null,
    imageUri: pump?.imageUri ?? null,
    createdTimestamp: pump?.createdTimestamp ?? null,
    lastTradeTimestamp: pump?.lastTradeTimestamp ?? null,
    trades24h: pump?.trades24h ?? null,
    source: sources.join("+") || "—",
    fetchedAt: Date.now(),
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
      "cache-control": "public, max-age=60",
    },
  });
});
