import { describe, expect, it } from "vitest";
import {
  getHeliusPumpCreatorWallet,
} from "../../supabase/functions/_shared/helius-pump-creator.ts";

const mintAddress = "So11111111111111111111111111111111111111112";
const creatorWallet = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const pumpProgramId = creatorWallet;

function scanResult(
  mint: string,
  creator: string,
  instructionName = "create",
) {
  return {
    parserStatus: "OK",
    parsed: {
      transactionStatus: "OK",
      instructions: [{
        programId: pumpProgramId,
        instructionName,
        decoded: {
          accounts: [
            { name: "mint", pubkey: mint },
            { name: "creator", pubkey: creator },
          ],
        },
      }],
    },
  };
}

function response(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });
}

describe("getHeliusPumpCreatorWallet", () => {
  it("queries the mint's history for successful Pump.fun create instructions", async () => {
    const fetcher: typeof fetch = async (input, init) => {
      expect(String(input)).toContain("https://mainnet.helius-rpc.com/v1/parsed-events/scan");
      expect(String(input)).toContain("api-key=test-key");
      expect(init?.method).toBe("POST");

      const body = JSON.parse(String(init?.body));
      expect(body.address).toBe(mintAddress);
      expect(body.sortOrder).toBe("asc");
      expect(body.match.programs).toEqual([{
        programId: pumpProgramId,
        instructions: ["create", "create_v2"],
      }]);

      return response({
        data: [scanResult(mintAddress, creatorWallet, "create_v2")],
        scan: { stoppedOn: "limit" },
      });
    };

    await expect(
      getHeliusPumpCreatorWallet(mintAddress, "test-key", fetcher),
    ).resolves.toBe(creatorWallet);
  });

  it("reports not found only after a complete history scan", async () => {
    const fetcher: typeof fetch = async () =>
      response({ data: [], scan: { stoppedOn: "windowEnd" } });

    await expect(
      getHeliusPumpCreatorWallet(mintAddress, "test-key", fetcher),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects an incomplete history scan rather than treating it as not found", async () => {
    const fetcher: typeof fetch = async () =>
      response({
        data: [],
        paginationToken: "next-page",
        scan: { stoppedOn: "budget" },
      });

    await expect(
      getHeliusPumpCreatorWallet(mintAddress, "test-key", fetcher),
    ).rejects.toMatchObject({ code: "incomplete" });
  });

  it("does not accept a create instruction for a different mint", async () => {
    const fetcher: typeof fetch = async () =>
      response({
        data: [scanResult(creatorWallet, creatorWallet)],
        scan: { stoppedOn: "windowEnd" },
      });

    await expect(
      getHeliusPumpCreatorWallet(mintAddress, "test-key", fetcher),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects a matching create instruction without a creator account", async () => {
    const result = scanResult(mintAddress, creatorWallet);
    result.parsed.instructions[0].decoded.accounts =
      result.parsed.instructions[0].decoded.accounts.slice(0, 1);
    const fetcher: typeof fetch = async () =>
      response({ data: [result], scan: { stoppedOn: "limit" } });

    await expect(
      getHeliusPumpCreatorWallet(mintAddress, "test-key", fetcher),
    ).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
});
