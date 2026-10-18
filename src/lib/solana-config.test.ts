import { PublicKey } from "@solana/web3.js";
import { resolveSolanaConfig, SolanaConfigError } from "./solana-config";

const validInput = {
  rhozeMint: PublicKey.unique().toBase58(),
  tokenProgramId: PublicKey.unique().toBase58(),
  treasuryAddress: PublicKey.unique().toBase58(),
  payoutAddress: PublicKey.unique().toBase58(),
};

describe("resolveSolanaConfig", () => {
  it("defaults non-production builds to a disabled Devnet profile", () => {
    expect(resolveSolanaConfig(validInput)).toMatchObject({
      environment: "devnet",
      cluster: "devnet",
      paymentsEnabled: false,
      claimsEnabled: false,
      anchoringEnabled: false,
    });
  });

  it("requires production builds to explicitly select and configure Mainnet", () => {
    expect(() => resolveSolanaConfig(validInput, "production")).toThrow(
      SolanaConfigError,
    );
    expect(() =>
      resolveSolanaConfig(
        { ...validInput, environment: "mainnet" },
        "production",
      ),
    ).toThrow(/mainnet requires an explicit rpcUrl/);
  });

  it("rejects a Devnet profile pointing at Mainnet", () => {
    expect(() =>
      resolveSolanaConfig({
        ...validInput,
        environment: "devnet",
        rpcUrl: "https://api.mainnet-beta.solana.com",
      }),
    ).toThrow(/devnet cannot use a mainnet RPC URL/);
  });

  it("rejects invalid public keys and unsupported environments", () => {
    expect(() =>
      resolveSolanaConfig({
        ...validInput,
        environment: "testnet",
        treasuryAddress: "not-a-public-key",
      }),
    ).toThrow(/environment must be "devnet" or "mainnet"/);

    expect(() =>
      resolveSolanaConfig({
        ...validInput,
        treasuryAddress: "not-a-public-key",
      }),
    ).toThrow(/treasuryAddress must be a valid Solana public key/);
  });

  it("parses feature flags and normalizes public keys", () => {
    const config = resolveSolanaConfig({
      ...validInput,
      environment: "devnet",
      paymentsEnabled: "true",
      claimsEnabled: true,
      anchoringEnabled: "false",
      rhozeDecimals: "9",
    });

    expect(config).toMatchObject({
      paymentsEnabled: true,
      claimsEnabled: true,
      anchoringEnabled: false,
      rhozeDecimals: 9,
    });
  });
});
