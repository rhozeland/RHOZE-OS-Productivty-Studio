import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from "https://esm.sh/@solana/web3.js@1.98.4";
import {
  getAssociatedTokenAddressSync as getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
} from "https://esm.sh/@solana/spl-token@0.4.9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RHOZE_MINT = new PublicKey("7khGn21aGKKAPi1LZF5EsdECdtyDcnYHtMKELrZDpump");
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const TOKEN_DECIMALS = 6;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { config_id, total_amount, purchase_id } = await req.json();
    if (!config_id || !total_amount || total_amount <= 0) {
      return new Response(JSON.stringify({ error: "config_id and positive total_amount required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get split config
    const { data: config, error: configError } = await adminClient
      .from("revenue_split_configs")
      .select("*")
      .eq("id", config_id)
      .eq("is_active", true)
      .single();

    if (configError || !config) {
      return new Response(JSON.stringify({ error: "Split config not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate splits
    const creatorAmount = Math.floor(total_amount * (config.creator_pct / 100));
    const curatorAmount = config.curator_id
      ? Math.floor(total_amount * (config.curator_pct / 100))
      : 0;
    const buybackAmount = total_amount - creatorAmount - curatorAmount;

    // Get wallets - look up profiles for Solana wallet addresses
    // For now, distribute as off-chain credits and log the split
    // On-chain splits happen when buyback_wallet is set

    // Off-chain credit distribution
    // Creator gets their share
    await adminClient.rpc("award_rhoze", {
      _user_id: config.creator_id,
      _amount: creatorAmount,
      _description: `Revenue split: ${config.creator_pct}% of ${total_amount} credits`,
    });

    // Curator gets their share if present
    if (config.curator_id && curatorAmount > 0) {
      await adminClient.rpc("award_rhoze", {
        _user_id: config.curator_id,
        _amount: curatorAmount,
        _description: `Curation split: ${config.curator_pct}% of ${total_amount} credits`,
      });
    }

    // Buyback pool: if wallet is set, transfer on-chain
    let solanaSignature = null;

    if (config.buyback_wallet && buybackAmount > 0) {
      try {
        const privateKeyStr = Deno.env.get("RHOZE_AIRDROP_PRIVATE_KEY");
        if (privateKeyStr) {
          const privateKeyArray = JSON.parse(privateKeyStr);
          const keypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
          const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

          const buybackPubkey = new PublicKey(config.buyback_wallet);
          const sourceATA = getAssociatedTokenAddress(RHOZE_MINT, keypair.publicKey);
          const destATA = getAssociatedTokenAddress(RHOZE_MINT, buybackPubkey);

          const tokenAmount = BigInt(buybackAmount) * BigInt(10 ** TOKEN_DECIMALS);
          const instructions: TransactionInstruction[] = [];

          // Try to check if dest ATA exists, create if not
          try {
            await connection.getAccountInfo(destATA);
          } catch {
            instructions.push(
              createAssociatedTokenAccountInstruction(
                keypair.publicKey,
                destATA,
                buybackPubkey,
                RHOZE_MINT
              )
            );
          }

          instructions.push(
            createTransferInstruction(sourceATA, destATA, keypair.publicKey, tokenAmount)
          );

          // Add memo
          const memo = JSON.stringify({
            protocol: "rhozeland",
            type: "buyback",
            amount: buybackAmount,
            config_id,
          });
          instructions.push(
            new TransactionInstruction({
              keys: [{ pubkey: keypair.publicKey, isSigner: true, isWritable: false }],
              programId: MEMO_PROGRAM_ID,
              data: new TextEncoder().encode(memo),
            })
          );

          const tx = new Transaction().add(...instructions);
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
          tx.recentBlockhash = blockhash;
          tx.lastValidBlockHeight = lastValidBlockHeight;
          tx.feePayer = keypair.publicKey;
          tx.sign(keypair);

          solanaSignature = await connection.sendRawTransaction(tx.serialize());
        }
      } catch (err) {
        console.error("Buyback transfer failed:", err.message);
        // Still log the split even if on-chain buyback fails
      }
    }

    // Log the split
    await adminClient.from("revenue_split_logs").insert({
      config_id,
      purchase_id: purchase_id || null,
      total_amount,
      creator_amount: creatorAmount,
      curator_amount: curatorAmount,
      buyback_amount: buybackAmount,
      solana_signature: solanaSignature,
    });

    return new Response(
      JSON.stringify({
        success: true,
        splits: {
          creator: creatorAmount,
          curator: curatorAmount,
          buyback: buybackAmount,
        },
        solana_signature: solanaSignature,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
