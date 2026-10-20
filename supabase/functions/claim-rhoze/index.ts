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
import { getSolanaConfig } from "../_shared/solana-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MIN_SOL_FOR_FEES = 0.002;

function respond(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function rpcCall(rpcUrl: string, method: string, params: unknown[]) {
  const res = await fetch(rpcUrl, {
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

  let reservedClaimId: string | null = null;
  let payoutSent = false;
  let payoutSignature: string | null = null;
  let mayReleaseReservation = false;
  let retryRequestId: string | null = null;
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

    const { wallet_address, credits_to_claim, request_id, payout_signature } = await req.json();
    retryRequestId = request_id ?? null;
    const config = getSolanaConfig();
    if (!config.claimsEnabled) {
      return respond({ ok: false, error: "Token claims are disabled for this environment" });
    }

    if (
      typeof wallet_address !== "string" ||
      typeof credits_to_claim !== "number" ||
      !Number.isFinite(credits_to_claim) ||
      credits_to_claim <= 0
    ) {
      return respond({ ok: false, error: "Missing wallet_address or credits_to_claim" });
    }
    if (!request_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request_id)) {
      return respond({ ok: false, error: "A valid claim request ID is required" });
    }

    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet_address)) {
      return respond({ ok: false, error: "Invalid wallet address" });
    }
    if (
      payout_signature !== undefined && payout_signature !== null &&
      (typeof payout_signature !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(payout_signature))
    ) {
      return respond({ ok: false, error: "Invalid payout signature" });
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

    const { data: reservation, error: reserveError } = await supabaseAdmin.rpc(
      "reserve_rhoze_claim",
      {
        p_request_id: request_id,
        p_user_id: user.id,
        p_wallet_address: wallet_address,
        p_credits: credits_to_claim,
      },
    );
    if (reserveError) {
      if (reserveError.message.includes("insufficient_credits")) {
        return respond({ ok: false, error: "Insufficient credits for this claim" });
      }
      if (reserveError.message.includes("claim_request_mismatch")) {
        return respond({
          ok: false,
          error: "This claim request ID is already bound to a different user, wallet, or amount.",
        });
      }
      throw reserveError;
    }
    if (reservation?.status === "completed" && reservation.signature) {
      return respond({ ok: true, success: true, signature: reservation.signature, idempotent: true });
    }
    if (reservation?.status !== "pending" || !reservation?.claim_id) {
      return respond({ ok: false, error: "Claim request is not available for processing" });
    }
    const claimId = reservation.claim_id;
    reservedClaimId = claimId;
    const isNewReservation = reservation.created === true;
    mayReleaseReservation = isNewReservation;
    payoutSignature = reservation.signature || payout_signature || null;

    if (!isNewReservation && !payoutSignature) {
      return respond({
        ok: false,
        pending: true,
        retryable: true,
        request_id,
        error: "This claim is reserved and has no recorded payout signature yet. Retry with the same claim request shortly.",
      });
    }

    const failClaim = async (message: string) => {
      const { error } = payoutSignature
        ? await supabaseAdmin.rpc("fail_rhoze_claim", {
            p_claim_id: claimId,
            p_error_message: message,
            p_signature: payoutSignature,
          })
        : await supabaseAdmin.rpc("fail_rhoze_claim", {
            p_claim_id: claimId,
            p_error_message: message,
          });
      if (error) console.error("Failed to release claim reservation:", error);
    };

    const connection = new Connection(config.rpcUrl, "confirmed");
    const mintPubkey = new PublicKey(config.rhozeMint);
    const recipientPubkey = new PublicKey(wallet_address);
    const tokenProgramId = new PublicKey(config.tokenProgramId);
    const tokenAmount = BigInt(Math.floor(credits_to_claim * Math.pow(10, config.rhozeDecimals)));
    const recipientATA = getAssociatedTokenAddressSync(mintPubkey, recipientPubkey, false, tokenProgramId);

    const settleVerifiedPayout = async (signature: string) => {
      const tx = await connection.getParsedTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (!tx) {
        return respond({
          ok: false,
          pending: true,
          retryable: true,
          request_id,
          signature,
          error: "Payout transaction is not confirmed yet. Retry this claim to check settlement.",
        });
      }
      if (tx.meta?.err) {
        if (!reservation.signature) {
          const { error: recordError } = await supabaseAdmin.rpc("record_rhoze_claim_signature", {
            p_claim_id: claimId,
            p_signature: signature,
          });
          if (recordError) throw recordError;
        }
        await failClaim("Payout transaction failed on-chain");
        return respond({ ok: false, error: "The payout transaction failed on-chain; reserved credits were restored." });
      }

      const accountKeys = tx.transaction.message.accountKeys;
      const payoutSigned = accountKeys.some((key: any) =>
        key.signer && key.pubkey.toBase58() === config.payoutAddress
      );
      const recipientAccountIndex = accountKeys.findIndex((key: any) =>
        key.pubkey.toBase58() === recipientATA.toBase58()
      );
      const recipientReceived = (tx.meta?.postTokenBalances ?? [])
        .filter((post: any) =>
          post.accountIndex === recipientAccountIndex &&
          post.mint === config.rhozeMint &&
          post.owner === wallet_address &&
          (!post.programId || post.programId === config.tokenProgramId)
        )
        .reduce((total: bigint, post: any) => {
          const pre = (tx.meta?.preTokenBalances ?? []).find(
            (balance: any) => balance.accountIndex === post.accountIndex && balance.mint === config.rhozeMint,
          );
          return total + BigInt(post.uiTokenAmount.amount) - BigInt(pre?.uiTokenAmount.amount ?? "0");
        }, 0n);

      if (!payoutSigned || recipientAccountIndex < 0 || recipientReceived !== tokenAmount) {
        return respond({
          ok: false,
          pending: true,
          retryable: false,
          request_id,
          signature,
          error: "The submitted signature does not prove this claim payout. The reservation remains pending for review.",
        });
      }

      const { error: recordError } = await supabaseAdmin.rpc("record_rhoze_claim_signature", {
        p_claim_id: claimId,
        p_signature: signature,
      });
      if (recordError) {
        return respond({
          ok: false,
          pending: true,
          retryable: true,
          request_id,
          signature,
          error: `Payout is confirmed, but saving its signature failed: ${recordError.message}`,
        });
      }

      const { error: completeError } = await supabaseAdmin.rpc("complete_rhoze_claim", {
        p_claim_id: claimId,
        p_signature: signature,
      });
      if (completeError) {
        return respond({
          ok: false,
          pending: true,
          retryable: true,
          request_id,
          signature,
          error: `Payout is confirmed, but database settlement needs retry: ${completeError.message}`,
        });
      }
      return respond({ ok: true, success: true, signature, tokens_sent: credits_to_claim, recovered: true });
    };

    if (payoutSignature) {
      return await settleVerifiedPayout(payoutSignature);
    }

    const privateKeyStr = Deno.env.get("RHOZE_AIRDROP_PRIVATE_KEY");
    if (!privateKeyStr) {
      await failClaim("Reward payout wallet is not configured");
      return respond({ ok: false, error: "Reward payout wallet is not configured yet." });
    }

    const airdropKeypair = parseAirdropKeypair(privateKeyStr);
    if (airdropKeypair.publicKey.toBase58() !== config.payoutAddress) {
      await failClaim("Payout wallet does not match configured address");
      return respond({
        ok: false,
        error: "Configured payout wallet does not match the payout private key",
      });
    }
    const airdropATA = getAssociatedTokenAddressSync(mintPubkey, airdropKeypair.publicKey, false, tokenProgramId);

    const [airdropSolBalance, airdropAtaInfo, recipientAtaCheck] = await Promise.all([
      connection.getBalance(airdropKeypair.publicKey),
      connection.getAccountInfo(airdropATA),
      rpcCall(config.rpcUrl, "getAccountInfo", [recipientATA.toBase58(), { encoding: "base64" }]),
    ]);

    if (airdropSolBalance < MIN_SOL_FOR_FEES * 1e9) {
      await failClaim("Payout wallet needs SOL for network fees");
      return respond({
        ok: false,
        error: "Reward claiming is temporarily unavailable: payout wallet needs SOL for network fees.",
      });
    }

    if (!airdropAtaInfo) {
      await failClaim("Payout wallet has no token account");
      return respond({
        ok: false,
        error: "Reward claiming is temporarily unavailable: payout wallet has no $RHOZE token account.",
      });
    }

    const sourceTokenBalance = await connection.getTokenAccountBalance(airdropATA).catch(() => null);
    const sourceTokenAmount = BigInt(sourceTokenBalance?.value?.amount ?? "0");

    if (sourceTokenAmount < tokenAmount) {
      await failClaim("Payout wallet does not hold enough tokens");
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
          mintPubkey,
          tokenProgramId
        )
      );
    }

    transaction.add(
      createTransferInstruction(
        airdropATA,
        recipientATA,
        airdropKeypair.publicKey,
        tokenAmount,
        [],
        tokenProgramId
      )
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = airdropKeypair.publicKey;
    transaction.sign(airdropKeypair);

    let sentSignature: string;
    try {
      sentSignature = await connection.sendRawTransaction(transaction.serialize());
      payoutSignature = sentSignature;
      payoutSent = true;
      const { error: recordError } = await supabaseAdmin.rpc("record_rhoze_claim_signature", {
        p_claim_id: claimId,
        p_signature: sentSignature,
      });
      if (recordError) throw recordError;
    } catch (error) {
      if (error instanceof SendTransactionError) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await failClaim(errorMessage);
        return respond({
          ok: false,
          error:
            "Reward claiming failed: token transfer could not be completed.",
          details: errorMessage,
        });
      }

      throw error;
    }

    return await settleVerifiedPayout(sentSignature);
  } catch (err: unknown) {
    console.error("claim-rhoze error:", err);
    if (reservedClaimId && mayReleaseReservation && !payoutSent) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { error } = await supabaseAdmin.rpc("fail_rhoze_claim", {
        p_claim_id: reservedClaimId,
        p_error_message: err instanceof Error ? err.message : "Claim failed unexpectedly.",
      });
      if (error) console.error("Failed to release claim reservation:", error);
    }
    return respond({
      ok: false,
      error: err instanceof Error ? err.message : "Claim failed unexpectedly.",
      ...(payoutSent ? {
        pending: true,
        retryable: true,
        request_id: retryRequestId,
        signature: payoutSignature,
      } : {}),
    });
  }
});
