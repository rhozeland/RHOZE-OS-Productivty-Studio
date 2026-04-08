import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "https://esm.sh/@solana/web3.js@1.98.4";
import { getAssociatedTokenAddressSync, createTransferInstruction, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "https://esm.sh/@solana/spl-token@0.4.9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RHOZE_MINT = new PublicKey("7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump");
const NETWORK = "mainnet-beta";
// pump.fun tokens use 6 decimals
const RHOZE_DECIMALS = 6;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { wallet_address, credits_to_claim } = await req.json();

    if (!wallet_address || !credits_to_claim || credits_to_claim <= 0) {
      return new Response(JSON.stringify({ error: "Missing wallet_address or credits_to_claim" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate wallet address
    let recipientPubkey: PublicKey;
    try {
      recipientPubkey = new PublicKey(wallet_address);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid wallet address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check user's claimable balance (reward-type credits only)
    const { data: creditData } = await supabaseAdmin
      .from("user_credits")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!creditData || creditData.balance < credits_to_claim) {
      return new Response(JSON.stringify({ error: `Insufficient credits. You have ${creditData?.balance ?? 0} but tried to claim ${credits_to_claim}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load airdrop wallet
    const privateKeyStr = Deno.env.get("RHOZE_AIRDROP_PRIVATE_KEY");
    if (!privateKeyStr) {
      return new Response(JSON.stringify({ error: "Airdrop wallet not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let airdropKeypair: Keypair;
    try {
      // Support both JSON array format [1,2,3,...] and base58
      const parsed = JSON.parse(privateKeyStr);
      airdropKeypair = Keypair.fromSecretKey(new Uint8Array(parsed));
    } catch {
      // Try base58 decode
      const { default: bs58 } = await import("https://esm.sh/bs58@6.0.0");
      airdropKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyStr));
    }

    const connection = new Connection(clusterApiUrl(NETWORK));

    // Token amount: credits * 10^decimals (1 credit = 1 $RHOZE token)
    const tokenAmount = BigInt(Math.floor(credits_to_claim * Math.pow(10, RHOZE_DECIMALS)));

    // Get or create associated token accounts
    const airdropATA = getAssociatedTokenAddressSync(RHOZE_MINT, airdropKeypair.publicKey);
    const recipientATA = getAssociatedTokenAddressSync(RHOZE_MINT, recipientPubkey);

    // Check if recipient ATA exists
    const recipientATAInfo = await connection.getAccountInfo(recipientATA);

    const { Transaction } = await import("https://esm.sh/@solana/web3.js@1.98.4");
    const transaction = new Transaction();

    // If recipient doesn't have an ATA, create one (funded by airdrop wallet)
    if (!recipientATAInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          airdropKeypair.publicKey, // payer
          recipientATA, // ata
          recipientPubkey, // owner
          RHOZE_MINT // mint
        )
      );
    }

    // Transfer tokens
    transaction.add(
      createTransferInstruction(
        airdropATA, // source
        recipientATA, // destination
        airdropKeypair.publicKey, // authority
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

    return new Response(
      JSON.stringify({ success: true, signature, tokens_sent: credits_to_claim }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("claim-rhoze error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
