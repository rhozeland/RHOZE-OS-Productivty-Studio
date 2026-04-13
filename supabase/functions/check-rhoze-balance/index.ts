const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RHOZE_MINT = "7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump";
const RPC_URL = "https://api.devnet.solana.com";
const RHOZE_DECIMALS = 6;

const TIERS = [
  { name: "play", min: 2000000, perks: ["Unlimited Boards", "Unlimited Drop Rooms", "15% studio discount", "Priority booking", "All perks unlocked"] },
  { name: "glow", min: 750000, perks: ["50 Boards", "12 hr Drop Rooms", "10% studio discount", "Priority booking"] },
  { name: "bloom", min: 100000, perks: ["15 Boards", "4 hr Drop Rooms", "5% studio discount", "Marketplace access"] },
  { name: "spark", min: 1, perks: ["Holder badge"] },
  { name: "none", min: 0, perks: [] },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function rpcCall(method: string, params: unknown[]) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const walletAddress = url.searchParams.get("wallet");

    if (!walletAddress) {
      return json({ error: "Missing wallet parameter" }, 400);
    }

    // Validate it looks like a base58 pubkey (32-44 chars, no invalid chars)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
      return json({ error: "Invalid wallet address" }, 400);
    }

    // Use getTokenAccountsByOwner RPC to find $RHOZE token accounts
    const result = await rpcCall("getTokenAccountsByOwner", [
      walletAddress,
      { mint: RHOZE_MINT },
      { encoding: "jsonParsed" },
    ]);

    let balance = 0;
    if (result?.result?.value?.length > 0) {
      const info = result.result.value[0].account.data.parsed.info;
      balance = Number(info.tokenAmount.amount) / Math.pow(10, RHOZE_DECIMALS);
    }

    const tier = TIERS.find((t) => balance >= t.min) || TIERS[TIERS.length - 1];

    return json({
      wallet: walletAddress,
      balance,
      tier: tier.name,
      perks: tier.perks,
      tiers: TIERS.map((t) => ({ name: t.name, min: t.min, perks: t.perks })),
    });
  } catch (err) {
    console.error("check-rhoze-balance error:", err);
    return json({ error: err.message }, 500);
  }
});
