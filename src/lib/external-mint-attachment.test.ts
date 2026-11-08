import { describe, expect, it } from "vitest";
import {
  accountInfoValue,
  buildExternalMintChallengeMessage,
  isInitializedSplMintAccount,
  isSolanaPublicKey,
  parsePumpCoin,
} from "../../supabase/functions/_shared/external-mint-attachment";

const MINT = "So11111111111111111111111111111111111111112";
const CREATOR = "11111111111111111111111111111111";

describe("external mint attachment validation", () => {
  it("validates base58 public keys without requiring the mint to be on-curve", () => {
    expect(isSolanaPublicKey(MINT)).toBe(true);
    expect(isSolanaPublicKey(CREATOR)).toBe(true);
    expect(isSolanaPublicKey("0OIl-invalid-address" )).toBe(false);
    expect(isSolanaPublicKey("1111111111111111111111111111111111111111111111111111111111111111")).toBe(false);
  });

  it("accepts pump.fun metadata only for the exact mint and sanitizes display fields", () => {
    expect(parsePumpCoin({
      mint: MINT,
      creator: CREATOR,
      name: "  Name\u0000\nToken  ",
      symbol: " TOK\u202eEN ",
      image_uri: "https://images.example/token.png",
    }, MINT)).toEqual({
      mint: MINT,
      creatorWallet: CREATOR,
      name: "Name Token",
      ticker: "TOKEN",
      imageUrl: "https://images.example/token.png",
    });
  });

  it("rejects missing or mismatched pump.fun mint metadata and unsafe image URLs", () => {
    const coin = { mint: MINT, creator: CREATOR, name: "Token", symbol: "TOK", image_uri: "javascript:alert(1)" };
    expect(parsePumpCoin(coin, CREATOR)).toBeNull();
    expect(parsePumpCoin({ ...coin, mint: undefined }, MINT)).toBeNull();
    expect(parsePumpCoin(coin, MINT)?.imageUrl).toBeNull();
    expect(parsePumpCoin({ ...coin, image_uri: "https://user:pass@images.example/token.png" }, MINT)?.imageUrl).toBeNull();
  });

  it("requires an initialized mint account owned by the configured SPL token program", () => {
    const mintData = new Uint8Array(82);
    mintData[44] = 9;
    mintData[45] = 1;
    expect(isInitializedSplMintAccount({ owner: "token-program", executable: false, data: mintData }, "token-program")).toBe(true);
    expect(isInitializedSplMintAccount({ owner: "token-program", executable: false, data: null }, "token-program")).toBe(false);
    expect(isInitializedSplMintAccount({ owner: "account-program", executable: false, data: mintData }, "token-program")).toBe(false);
    expect(isInitializedSplMintAccount({ owner: "token-program", executable: true, data: mintData }, "token-program")).toBe(false);
    mintData[45] = 0;
    expect(isInitializedSplMintAccount({ owner: "token-program", executable: false, data: mintData }, "token-program")).toBe(false);
  });

  it("unwraps Solana getAccountInfo results from result.value", () => {
    const account = { owner: "token-program", executable: false };
    expect(accountInfoValue({ context: { slot: 123 }, value: account })).toEqual(account);
    expect(accountInfoValue({ context: { slot: 123 }, value: null })).toBeNull();
  });

  it("binds the signature text to the user, mint, target, creator, and nonce", () => {
    const message = buildExternalMintChallengeMessage({
      challengeId: "challenge",
      userId: "user",
      targetType: "project",
      targetId: "target",
      mint: MINT,
      creatorWallet: CREATOR,
      nonce: "random-nonce",
      issuedAt: "2026-11-07T00:00:00.000Z",
      expiresAt: "2026-11-07T00:05:00.000Z",
    });
    expect(message).toContain(`User ID: user`);
    expect(message).toContain(`Target type: project\nTarget ID: target`);
    expect(message).toContain(`Mint: ${MINT}`);
    expect(message).toContain(`Creator wallet: ${CREATOR}`);
    expect(message).toContain("Nonce: random-nonce");
  });
});
