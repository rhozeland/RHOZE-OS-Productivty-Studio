const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RHOZE_MINT_STR = "7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump";
const NETWORK = "devnet";
const RHOZE_DECIMALS = 6;

const TIERS = [
  { name: "diamond", min: 100000, perks: ["Boosted listings", "Exclusive Drop Rooms", "Priority support", "Custom profile badge"] },
  { name: "gold", min: 10000, perks: ["Boosted listings", "Exclusive Drop Rooms", "Priority support"] },
  { name: "silver", min: 1000, perks: ["Boosted listings", "Exclusive Drop Rooms"] },
  { name: "bronze", min: 100, perks: ["Boosted listings"] },
  { name: "holder", min: 1, perks: ["Holder badge"] },
  { name: "none", min: 0, perks: [] },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

    // Dynamic import to avoid top-level init crash
    const { Connection, PublicKey, clusterApiUrl } = await import(
      "https://esm.sh/@solana/web3.js@1.98.4"
    );
    const { getAssociatedTokenAddressSync } = await import(
      "https://esm.sh/@solana/spl-token@0.4.9"
    );

    const RHOZE_MINT = new PublicKey(RHOZE_MINT_STR);

    let walletPubkey: InstanceType<typeof PublicKey>;
    try {
      walletPubkey = new PublicKey(walletAddress);
    } catch {
      return json({ error: "Invalid wallet address" }, 400);
    }

    const connection = new Connection(clusterApiUrl(NETWORK));
    const ata = getAssociatedTokenAddressSync(RHOZE_MINT, walletPubkey);

    let balance = 0;
    try {
      const tokenAccount = await connection.getTokenAccountBalance(ata);
      balance = Number(tokenAccount.value.amount) / Math.pow(10, RHOZE_DECIMALS);
    } catch {
      balance = 0;
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
