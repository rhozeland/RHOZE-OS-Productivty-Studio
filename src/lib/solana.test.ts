// @vitest-environment node

import {
  Connection,
  Keypair,
  SystemInstruction,
  type Transaction,
} from "@solana/web3.js";
import { getConnection, createTransferTransaction, confirmTransaction } from "./solana";

describe("Solana transaction routing", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["devnet", "development", "https://api.devnet.solana.com"],
    ["mainnet", "production", "https://rpc.example.test/mainnet"],
  ] as const)("creates a %s connection using the resolved RPC", (environment, mode, rpcUrl) => {
    vi.stubEnv("MODE", mode);
    vi.stubEnv("VITE_SOLANA_ENV", environment);
    vi.stubEnv("VITE_SOLANA_RPC_URL", rpcUrl);

    expect(getConnection().rpcEndpoint).toBe(rpcUrl);
  });

  it("requires an explicit Solana environment when creating a production connection", () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_SOLANA_ENV", "");
    vi.stubEnv("VITE_SOLANA_RPC_URL", "");

    expect(() => getConnection()).toThrow(
      'environment must be "devnet" or "mainnet" and must be explicitly set in production',
    );
  });
});

describe("SOL transfer transaction flow", () => {
  const payer = Keypair.generate().publicKey;
  const recipient = Keypair.generate().publicKey;
  const blockhash = Keypair.generate().publicKey.toBase58();

  it("builds a transfer with the requested amount, payer, and confirmed blockhash", async () => {
    const connection = {
      getLatestBlockhash: vi.fn().mockResolvedValue({
        blockhash,
        lastValidBlockHeight: 456,
      }),
    } as unknown as Connection;

    const transaction = await createTransferTransaction(
      payer,
      recipient,
      1.25,
      connection,
    );

    expect(connection.getLatestBlockhash).toHaveBeenCalledWith("confirmed");
    expect(transaction.feePayer?.toBase58()).toBe(payer.toBase58());
    expect(transaction.recentBlockhash).toBe(blockhash);
    expect(transaction.lastValidBlockHeight).toBe(456);
    expect(transaction.instructions).toHaveLength(1);
    const transfer = SystemInstruction.decodeTransfer(transaction.instructions[0]);
    expect(transfer.fromPubkey.equals(payer)).toBe(true);
    expect(transfer.toPubkey.equals(recipient)).toBe(true);
    expect(transfer.lamports).toBe(1_250_000_000n);
  });

  it("confirms a submitted transaction with its blockhash expiry at confirmed commitment", async () => {
    const transaction = {
      recentBlockhash: blockhash,
      lastValidBlockHeight: 456,
    } as Pick<Transaction, "recentBlockhash" | "lastValidBlockHeight">;
    const connection = {
      confirmTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
    } as unknown as Connection;

    await confirmTransaction("test-signature", transaction, connection);

    expect(connection.confirmTransaction).toHaveBeenCalledWith(
      {
        signature: "test-signature",
        blockhash,
        lastValidBlockHeight: 456,
      },
      "confirmed",
    );
  });

  it.each([
    {
      recentBlockhash: null,
      lastValidBlockHeight: null,
    },
    {
      recentBlockhash: blockhash,
      lastValidBlockHeight: null,
    },
    {
      recentBlockhash: null,
      lastValidBlockHeight: 456,
    },
  ])("rejects confirmation when blockhash expiry data is incomplete", async (expiry) => {
    const connection = {
      confirmTransaction: vi.fn(),
    } as unknown as Connection;

    await expect(
      confirmTransaction("test-signature", expiry, connection),
    ).rejects.toThrow("Cannot confirm transaction without its blockhash expiry.");
    expect(connection.confirmTransaction).not.toHaveBeenCalled();
  });
});
