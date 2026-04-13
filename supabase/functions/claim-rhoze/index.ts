import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RHOZE_MINT_STR = "7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump";
const NETWORK = "devnet";
const RHOZE_DECIMALS = 6;

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
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { wallet_address, credits_to_claim } = await req.json();

    if (!wallet_address || !credits_to_claim || credits_to_claim <= 0) {
      return json({ error: "Missing wallet_address or credits_to_claim" }, 400);
    }

    // Dynamic imports to avoid top-level init crash
    const { Connection, Keypair, PublicKey, Transaction, clusterApiUrl } = await import(
      "https://esm.sh/@solana/web3.js@1.98.4"
    );
    const {
      getAssociatedTokenAddressSync,
      createTransferInstruction,
      createAssociatedTokenAccountInstruction,
    } = await import("https://esm.sh/@solana/spl-token@0.4.9");

    const RHOZE_MINT = new PublicKey(RHOZE_MINT_STR);

    let recipientPubkey: InstanceType<typeof PublicKey>;
    try {
      recipientPubkey = new PublicKey(wallet_address);
    } catch {
      return json({ error: "Invalid wallet address" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check user's claimable balance
    const { data: creditData } = await supabaseAdmin
      .from("user_credits")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!creditData || creditData.balance < credits_to_claim) {
      return json({
        error: `Insufficient credits. You have ${creditData?.balance ?? 0} but tried to claim ${credits_to_claim}`,
      }, 400);
    }

    // Load airdrop wallet
    const privateKeyStr = Deno.env.get("RHOZE_AIRDROP_PRIVATE_KEY");
    if (!privateKeyStr) {
      return json({ error: "Airdrop wallet not configured" }, 500);
    }

    let airdropKeypair: InstanceType<typeof Keypair>;
    try {
      const parsed = JSON.parse(privateKeyStr);
      airdropKeypair = Keypair.fromSecretKey(new Uint8Array(parsed));
    } catch {
      const { default: bs58 } = await import("https://esm.sh/bs58@6.0.0");
      airdropKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyStr));
    }

    const connection = new Connection(clusterApiUrl(NETWORK));

    // 1 credit = 1 $RHOZE token
    const tokenAmount = BigInt(Math.floor(credits_to_claim * Math.pow(10, RHOZE_DECIMALS)));

    const airdropATA = getAssociatedTokenAddressSync(RHOZE_MINT, airdropKeypair.publicKey);
    const recipientATA = getAssociatedTokenAddressSync(RHOZE_MINT, recipientPubkey);

    // Check if recipient ATA exists
    const recipientATAInfo = await connection.getAccountInfo(recipientATA);

    const transaction = new Transaction();

    // Create ATA for recipient if needed (funded by airdrop wallet)
    if (!recipientATAInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          airdropKeypair.publicKey,
          recipientATA,
          recipientPubkey,
          RHOZE_MINT
        )
      );
    }

    // Transfer tokens
    transaction.add(
      createTransferInstruction(
        airdropATA,
        recipientATA,
        airdropKeypair.publicKey,
        tokenAmount
      )
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = airdropKeypair.publicKey;

    transaction.sign(airdropKeypair);
    const signature = await connection.sendRawTransaction(transaction.serialize());

    // Deduct credits from user balance
    await supabaseAdmin
      .from("user_credits")
      .update({
        balance: creditData.balance - credits_to_claim,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    // Log the claim transaction
    await supabaseAdmin
      .from("credit_transactions")
      .insert({
        user_id: user.id,
        amount: -credits_to_claim,
        type: "claim",
        description: `Claimed ${credits_to_claim} $RHOZE to ${wallet_address.slice(0, 6)}...`,
        payment_method: "crypto",
        payment_reference: signature,
      });

    return json({ success: true, signature, tokens_sent: credits_to_claim });
  } catch (err) {
    console.error("claim-rhoze error:", err);
    return json({ error: err.message }, 500);
  }
});
