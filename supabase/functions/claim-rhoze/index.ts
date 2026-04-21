import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  Keypair,
  PublicKey,
  Transaction,
  Connection,
  SendTransactionError,
} from "npm:@solana/web3.js@1.98.4";
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
} from "npm:@solana/spl-token@0.4.9";
import bs58 from "npm:bs58@6.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RHOZE_MINT = "7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump";
const RPC_URL = "https://api.mainnet-beta.solana.com";
const RHOZE_DECIMALS = 6;
const MIN_SOL_FOR_FEES = 0.002;

function respond(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
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

function parseAirdropKeypair(privateKeyStr: string) {
  try {
    const parsed = JSON.parse(privateKeyStr);
    return Keypair.fromSecretKey(new Uint8Array(parsed));
  } catch {
    return Keypair.fromSecretKey(bs58.decode(privateKeyStr));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return respond({ ok: false, error: "Unauthorized" });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authErr,
    } = await supabaseUser.auth.getUser();

    if (authErr || !user) {
      return respond({ ok: false, error: "Unauthorized" });
    }

    const { wallet_address, credits_to_claim } = await req.json();

    if (!wallet_address || !credits_to_claim || credits_to_claim <= 0) {
      return respond({ ok: false, error: "Missing wallet_address or credits_to_claim" });
    }

    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet_address)) {
      return respond({ ok: false, error: "Invalid wallet address" });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("wallet_address, wallet_locked")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return respond({ ok: false, error: "Profile not found" });
    }

    if (profile.wallet_address && profile.wallet_address !== wallet_address) {
      return respond({
        ok: false,
        error:
          "Wallet mismatch. Your account is bound to " +
          profile.wallet_address.slice(0, 6) +
          "... — submit a change request to switch wallets.",
      });
    }

    if (!profile.wallet_address) {
      await supabaseAdmin
        .from("profiles")
        .update({ wallet_address, wallet_locked: true, updated_at: new Date().toISOString() } as never)
        .eq("user_id", user.id);
    } else if (!profile.wallet_locked) {
      await supabaseAdmin
        .from("profiles")
        .update({ wallet_locked: true, updated_at: new Date().toISOString() } as never)
        .eq("user_id", user.id);
    }

    const { data: creditData } = await supabaseAdmin
      .from("user_credits")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!creditData || creditData.balance < credits_to_claim) {
      return respond({
        ok: false,
        error: `Insufficient credits. You have ${creditData?.balance ?? 0} but tried to claim ${credits_to_claim}`,
      });
    }

    const privateKeyStr = Deno.env.get("RHOZE_AIRDROP_PRIVATE_KEY");
    if (!privateKeyStr) {
      return respond({ ok: false, error: "Reward payout wallet is not configured yet." });
    }

    const airdropKeypair = parseAirdropKeypair(privateKeyStr);
    const connection = new Connection(RPC_URL);
    const mintPubkey = new PublicKey(RHOZE_MINT);
    const recipientPubkey = new PublicKey(wallet_address);
    const tokenAmount = BigInt(Math.floor(credits_to_claim * Math.pow(10, RHOZE_DECIMALS)));

    const airdropATA = getAssociatedTokenAddressSync(mintPubkey, airdropKeypair.publicKey);
    const recipientATA = getAssociatedTokenAddressSync(mintPubkey, recipientPubkey);

    const [airdropSolBalance, airdropAtaInfo, recipientAtaCheck] = await Promise.all([
      connection.getBalance(airdropKeypair.publicKey),
      connection.getAccountInfo(airdropATA),
      rpcCall("getAccountInfo", [recipientATA.toBase58(), { encoding: "base64" }]),
    ]);

    if (airdropSolBalance < MIN_SOL_FOR_FEES * 1e9) {
      return respond({
        ok: false,
        error: "Reward claiming is temporarily unavailable: payout wallet needs SOL for network fees.",
      });
    }

    if (!airdropAtaInfo) {
      return respond({
        ok: false,
        error: "Reward claiming is temporarily unavailable: payout wallet has no $RHOZE token account.",
      });
    }

    const sourceTokenBalance = await connection.getTokenAccountBalance(airdropATA).catch(() => null);
    const sourceTokenAmount = BigInt(sourceTokenBalance?.value?.amount ?? "0");

    if (sourceTokenAmount < tokenAmount) {
      return respond({
        ok: false,
        error: "Reward claiming is temporarily unavailable: payout wallet does not currently hold enough $RHOZE.",
      });
    }

    const transaction = new Transaction();

    if (!recipientAtaCheck?.result?.value) {
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

    let signature = "";

    try {
      signature = await connection.sendRawTransaction(transaction.serialize());
    } catch (error) {
      if (error instanceof SendTransactionError) {
        return respond({
          ok: false,
          error:
            "Reward claiming failed: token transfer could not be completed.",
          details: error.message,
        });
      }

      throw error;
    }

    await supabaseAdmin
      .from("user_credits")
      .update({
        balance: creditData.balance - credits_to_claim,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    await supabaseAdmin.from("credit_transactions").insert({
      user_id: user.id,
      amount: -credits_to_claim,
      type: "claim",
      description: `Claimed ${credits_to_claim} $RHOZE to ${wallet_address.slice(0, 6)}...`,
      payment_method: "crypto",
      payment_reference: signature,
    });

    return respond({ ok: true, success: true, signature, tokens_sent: credits_to_claim });
  } catch (err: unknown) {
    console.error("claim-rhoze error:", err);
    return respond({
      ok: false,
      error: err instanceof Error ? err.message : "Claim failed unexpectedly.",
    });
  }
});
