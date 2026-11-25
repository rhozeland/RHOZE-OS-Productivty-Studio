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

const makeInitializedMintData = (decimals = 9) => {
  const data = new Uint8Array(82);
  data[44] = decimals;
  data[45] = 1;
  return data;
};

const makeExtendedMintData = (extensionType = 3, extensionValue = new Uint8Array(32)) => {
  const tlvStart = 166;
  const data = new Uint8Array(tlvStart + 4 + extensionValue.length);
  data.set(makeInitializedMintData());
  data[165] = 1; // Token-2022 AccountType::Mint
  data[tlvStart] = extensionType & 0xff;
  data[tlvStart + 1] = extensionType >> 8;
  data[tlvStart + 2] = extensionValue.length & 0xff;
  data[tlvStart + 3] = extensionValue.length >> 8;
  data.set(extensionValue, tlvStart + 4);
  return data;
};

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
    const mintData = makeInitializedMintData();
    expect(isInitializedSplMintAccount({ owner: "token-program", executable: false, data: mintData }, "token-program")).toBe(true);
    expect(isInitializedSplMintAccount({ owner: "token-program", executable: false, data: null }, "token-program")).toBe(false);
    expect(isInitializedSplMintAccount({ owner: "account-program", executable: false, data: mintData }, "token-program")).toBe(false);
    expect(isInitializedSplMintAccount({ owner: "token-program", executable: true, data: mintData }, "token-program")).toBe(false);
    mintData[45] = 0;
    expect(isInitializedSplMintAccount({ owner: "token-program", executable: false, data: mintData }, "token-program")).toBe(false);
  });

  it("accepts an initialized base mint with the SPL u8 decimals field", () => {
    expect(isInitializedSplMintAccount({
      owner: "token-program",
      executable: false,
      data: makeInitializedMintData(255),
    }, "token-program")).toBe(true);
  });

  it("does not classify a 165-byte token-holding account as a mint", () => {
    const tokenAccountData = new Uint8Array(165);
    tokenAccountData[44] = 9;
    tokenAccountData[45] = 1;
    tokenAccountData[108] = 1;

    expect(isInitializedSplMintAccount({
      owner: "token-program",
      executable: false,
      data: tokenAccountData,
    }, "token-program")).toBe(false);
  });

  it("accepts an initialized Token-2022 mint with the mint discriminator and a valid TLV entry", () => {
    expect(isInitializedSplMintAccount({
      owner: "token-program",
      executable: false,
      data: makeExtendedMintData(3, new Uint8Array(32)),
    }, "token-program")).toBe(true);
  });

  it("accepts Token-2022's one-byte trailing TLV reallocation padding", () => {
    const mintData = makeExtendedMintData(3, new Uint8Array(32));
    const paddedMintData = new Uint8Array(mintData.length + 1);
    paddedMintData.set(mintData);
    paddedMintData[paddedMintData.length - 1] = 0x7f;

    expect(isInitializedSplMintAccount({
      owner: "token-program",
      executable: false,
      data: paddedMintData,
    }, "token-program")).toBe(true);
  });

  it("rejects standard and extended Token-2022 token-holding accounts", () => {
    const standardTokenAccount = new Uint8Array(165);
    standardTokenAccount[44] = 9;
    standardTokenAccount[45] = 1;
    standardTokenAccount[108] = 1;

    const extendedTokenAccount = new Uint8Array(165 + 1 + 4 + 8);
    extendedTokenAccount[44] = 9;
    extendedTokenAccount[45] = 1;
    extendedTokenAccount[108] = 1;
    extendedTokenAccount[165] = 2; // Token-2022 AccountType::Account
    extendedTokenAccount[166] = 2; // TransferFeeAmount
    extendedTokenAccount[168] = 8;

    for (const data of [standardTokenAccount, extendedTokenAccount]) {
      expect(isInitializedSplMintAccount({
        owner: "token-program",
        executable: false,
        data,
      }, "token-program")).toBe(false);
    }
  });

  it.each([
    new Uint8Array(81),
    new Uint8Array(83),
    (() => { const data = makeInitializedMintData(); data[0] = 2; return data; })(),
    (() => { const data = makeExtendedMintData(); data[82] = 1; return data; })(),
    (() => { const data = makeExtendedMintData(); data[165] = 2; return data; })(),
    makeExtendedMintData(2, new Uint8Array(8)),
    (() => { const data = makeExtendedMintData(); data[168] = 33; return data; })(),
    (() => { const data = new Uint8Array(166); data.set(makeInitializedMintData()); data[165] = 1; return data; })(),
    (() => { const data = new Uint8Array(167); data.set(makeInitializedMintData()); data[165] = 1; data[166] = 0x7f; return data; })(),
  ])("rejects malformed or unsupported mint account layouts", (data) => {
    expect(isInitializedSplMintAccount({
      owner: "token-program",
      executable: false,
      data,
    }, "token-program")).toBe(false);
  });

  it("unwraps Solana getAccountInfo results from result.value", () => {
    const account = { owner: "token-program", executable: false };
    const responseWithAccount = { context: { slot: 123 }, value: account };
    const responseWithoutAccount = { context: { slot: 123 }, value: null };
    expect(accountInfoValue(responseWithAccount)).toEqual(account);
    expect(accountInfoValue(responseWithoutAccount)).toBeNull();
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
