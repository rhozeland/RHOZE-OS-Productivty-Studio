import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RHOZE_MINT = "7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump";
const RPC_URL = "https://api.devnet.solana.com";
const RHOZE_DECIMALS = 6;

// SPL Token Program & Associated Token Program IDs
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ATA_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";

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

    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet_address)) {
      return json({ error: "Invalid wallet address" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Enforce wallet binding: wallet must match the one stored in profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("wallet_address, wallet_locked")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return json({ error: "Profile not found" }, 400);
    }

    if (profile.wallet_address && profile.wallet_address !== wallet_address) {
      return json({
        error: "Wallet mismatch. Your account is bound to " + profile.wallet_address.slice(0, 6) + "... — submit a change request to switch wallets.",
      }, 403);
    }

    // If no wallet set yet, bind this one and lock it
    if (!profile.wallet_address) {
      await supabaseAdmin
        .from("profiles")
        .update({ wallet_address, wallet_locked: true, updated_at: new Date().toISOString() } as any)
        .eq("user_id", user.id);
    } else if (!profile.wallet_locked) {
      // Lock existing wallet
      await supabaseAdmin
        .from("profiles")
        .update({ wallet_locked: true, updated_at: new Date().toISOString() } as any)
        .eq("user_id", user.id);
    }

    // Check user's claimable balance (supabaseAdmin already created above)

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

    // Load airdrop wallet - we need the SDK for signing transactions
    // Use a lighter approach: build the transaction using the SDK dynamically
    const privateKeyStr = Deno.env.get("RHOZE_AIRDROP_PRIVATE_KEY");
    if (!privateKeyStr) {
      return json({ error: "Airdrop wallet not configured" }, 500);
    }

    // Import only what we need, dynamically
    const { Keypair, PublicKey, Transaction, Connection } = await import(
      "https://esm.sh/@solana/web3.js@1.98.4?bundle"
    );
    const {
      getAssociatedTokenAddressSync,
      createTransferInstruction,
      createAssociatedTokenAccountInstruction,
    } = await import("https://esm.sh/@solana/spl-token@0.4.9?bundle");

    let airdropKeypair: InstanceType<typeof Keypair>;
    try {
      const parsed = JSON.parse(privateKeyStr);
      airdropKeypair = Keypair.fromSecretKey(new Uint8Array(parsed));
    } catch {
      const { default: bs58 } = await import("https://esm.sh/bs58@6.0.0");
      airdropKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyStr));
    }

    const mintPubkey = new PublicKey(RHOZE_MINT);
    const recipientPubkey = new PublicKey(wallet_address);
    const tokenAmount = BigInt(Math.floor(credits_to_claim * Math.pow(10, RHOZE_DECIMALS)));

    const airdropATA = getAssociatedTokenAddressSync(mintPubkey, airdropKeypair.publicKey);
    const recipientATA = getAssociatedTokenAddressSync(mintPubkey, recipientPubkey);

    // Check if recipient ATA exists via RPC (lighter than SDK method)
    const ataCheck = await rpcCall("getAccountInfo", [recipientATA.toBase58(), { encoding: "base64" }]);

    const connection = new Connection(RPC_URL);
    const transaction = new Transaction();

    if (!ataCheck?.result?.value) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          airdropKeypair.publicKey,
          recipientATA,
          recipientPubkey,
          mintPubkey
        )
      );
    }

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
