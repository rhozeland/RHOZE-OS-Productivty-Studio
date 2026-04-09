import { Connection, PublicKey, clusterApiUrl } from "https://esm.sh/@solana/web3.js@1.98.4";
import { getAssociatedTokenAddressSync } from "https://esm.sh/@solana/spl-token@0.4.9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RHOZE_MINT = new PublicKey("7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump");
const NETWORK = "devnet";
const RHOZE_DECIMALS = 6;

// Token-gated tier thresholds
const TIERS = [
  { name: "diamond", min: 100000, perks: ["Boosted listings", "Exclusive Drop Rooms", "Priority support", "Custom profile badge"] },
  { name: "gold", min: 10000, perks: ["Boosted listings", "Exclusive Drop Rooms", "Priority support"] },
  { name: "silver", min: 1000, perks: ["Boosted listings", "Exclusive Drop Rooms"] },
  { name: "bronze", min: 100, perks: ["Boosted listings"] },
  { name: "holder", min: 1, perks: ["Holder badge"] },
  { name: "none", min: 0, perks: [] },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const walletAddress = url.searchParams.get("wallet");

    if (!walletAddress) {
      return new Response(JSON.stringify({ error: "Missing wallet parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let walletPubkey: PublicKey;
    try {
      walletPubkey = new PublicKey(walletAddress);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid wallet address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connection = new Connection(clusterApiUrl(NETWORK));
    const ata = getAssociatedTokenAddressSync(RHOZE_MINT, walletPubkey);

    let balance = 0;
    try {
      const tokenAccount = await connection.getTokenAccountBalance(ata);
      balance = Number(tokenAccount.value.amount) / Math.pow(10, RHOZE_DECIMALS);
    } catch {
      // ATA doesn't exist = 0 balance
      balance = 0;
    }

    // Determine tier
    const tier = TIERS.find((t) => balance >= t.min) || TIERS[TIERS.length - 1];

    return new Response(
      JSON.stringify({
        wallet: walletAddress,
        balance,
        tier: tier.name,
        perks: tier.perks,
        tiers: TIERS.map((t) => ({ name: t.name, min: t.min, perks: t.perks })),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-rhoze-balance error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
