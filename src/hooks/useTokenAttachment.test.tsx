import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTokenAttachment } from "@/hooks/useTokenAttachment";
import { WalletConnectionRequiredError } from "@/lib/token-attachment";

const mocks = vi.hoisted(() => ({
  wallet: {} as any,
  user: { id: "creator-id" } as any,
  setVisible: vi.fn(),
  rpc: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@solana/wallet-adapter-react", () => ({ useWallet: () => mocks.wallet }));
vi.mock("@solana/wallet-adapter-react-ui", () => ({ useWalletModal: () => ({ setVisible: mocks.setVisible }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
    functions: { invoke: mocks.invoke },
  },
}));

const challenge = {
  challengeId: "d1047077-8fb1-4ddf-9c43-ccf713a3ebf4",
  message: "Exact server challenge message",
};
const attached = {
  attached: true,
  token: { mint: "VerifiedMint111111111111111111111111111111", name: "Verified Coin", ticker: "VERI", imageUrl: null },
};

const makeHook = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...renderHook(() => useTokenAttachment(), { wrapper }), queryClient };
};

describe("useTokenAttachment", () => {
  beforeEach(() => {
    mocks.setVisible.mockReset();
    mocks.rpc.mockReset().mockResolvedValue({ error: null });
    mocks.invoke.mockReset();
    mocks.user = { id: "creator-id" };
    mocks.wallet = {
      connected: true,
      publicKey: { toBase58: () => "ConnectedWallet1111111111111111111111111111" },
      signMessage: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    };
  });

  it("opens the wallet chooser and sends no request while disconnected", async () => {
    mocks.wallet = { connected: false, publicKey: null, signMessage: undefined };
    const { result } = makeHook();
    let caught: unknown;

    await act(async () => {
      try {
        await result.current.attachExternal({ mintAddress: "Mint111111111111111111111111111111111111111", targetType: "work", targetId: "work-id" });
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(WalletConnectionRequiredError);
    expect(mocks.setVisible).toHaveBeenCalledWith(true);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("prevents duplicate submissions while the server challenge is in flight", async () => {
    let resolveChallenge!: (value: { data: typeof challenge; error: null }) => void;
    mocks.invoke.mockImplementation((_name: string, { body }: any) => {
      if (body.action === "challenge") {
        return new Promise((resolve) => { resolveChallenge = resolve; });
      }
      return Promise.resolve({ data: attached, error: null });
    });
    const { result } = makeHook();
    let first!: Promise<unknown>;

    act(() => {
      first = result.current.attachExternal({ mintAddress: "Mint111111111111111111111111111111111111111", targetType: "project", targetId: "project-id" });
    });
    const duplicate = await result.current.attachExternal({ mintAddress: "Mint111111111111111111111111111111111111111", targetType: "project", targetId: "project-id" });
    expect(duplicate).toBeUndefined();
    expect(mocks.invoke).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveChallenge({ data: challenge, error: null });
      await first;
    });
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
    expect(mocks.wallet.signMessage).toHaveBeenCalledWith(new TextEncoder().encode(challenge.message));
  });

  it.each(["project", "work"] as const)("calls the secure Edge Function for external %s attachments", async (targetType) => {
    mocks.invoke
      .mockResolvedValueOnce({ data: challenge, error: null })
      .mockResolvedValueOnce({ data: attached, error: null });
    const { result } = makeHook();

    await act(async () => {
      await result.current.attachExternal({
        mintAddress: "ClientMint111111111111111111111111111111",
        targetType,
        targetId: `${targetType}-id`,
      });
    });

    expect(mocks.invoke).toHaveBeenNthCalledWith(1, "attach-external-pump-token", {
      body: expect.objectContaining({ action: "challenge", targetType, targetId: `${targetType}-id` }),
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, "attach-external-pump-token", {
      body: expect.objectContaining({ action: "attach", challengeId: challenge.challengeId }),
    });
  });

  it("refreshes Project and Work display queries after successful changes", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    const { result, queryClient } = makeHook();

    await act(async () => {
      await result.current.attachApproved({ tokenId: "approved-id", targetType: "project", targetId: "project-id" });
    });
    await act(async () => {
      await result.current.unlink({ targetType: "work", targetId: "work-id" });
    });

    const refreshedKeys = vi.mocked(queryClient.invalidateQueries).mock.calls.map(([options]) => options.queryKey);
    expect(refreshedKeys).toContainEqual(["project", "project-id"]);
    expect(refreshedKeys).toContainEqual(["release-linked-token"]);
    expect(refreshedKeys).toContainEqual(["works-lightbox"]);
    expect(refreshedKeys).toContainEqual(["work-token-chip"]);
  });
});
