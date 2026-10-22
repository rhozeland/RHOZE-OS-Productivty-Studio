import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  cleanup,
  waitFor,
  act,
  fireEvent,
  screen,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * WalletButton must never link a wallet on its own. It waits for
 * the profile's linked-wallet state, then hands off to the signed-challenge
 * handshake in `@/lib/wallet-verification`; the backend is the only writer of
 * profiles.wallet_address. Each test uses its own wallet address because the
 * component remembers (until the wallet disconnects) which user:wallet pairs
 * it has already auto-prompted for. The dropdown is rendered inline so its
 * menu items can be clicked.
 */

const mocks = vi.hoisted(() => ({
  wallet: {
    connected: true,
    publicKey: null as null | { toBase58: () => string },
    signMessage: vi.fn(),
    disconnect: vi.fn(),
  },
  auth: { user: { id: "user-1" } as { id: string } | null },
  rpc: vi.fn(),
  from: vi.fn(),
  verifyWalletOwnership: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => mocks.wallet,
}));
vi.mock("@solana/wallet-adapter-react-ui", () => ({
  useWalletModal: () => ({ setVisible: vi.fn() }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mocks.rpc(...args),
    from: (...args: unknown[]) => mocks.from(...args),
    functions: { invoke: vi.fn() },
  },
}));
vi.mock("@/lib/wallet-verification", async (importActual) => {
  const actual =
    await importActual<typeof import("@/lib/wallet-verification")>();
  return {
    ...actual,
    verifyWalletOwnership: (...args: unknown[]) =>
      mocks.verifyWalletOwnership(...args),
  };
});
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/components/ui/dropdown-menu", async () => {
  const { createElement, Fragment } = await import("react");
  const Passthrough = ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children);
  return {
    DropdownMenu: Passthrough,
    DropdownMenuTrigger: Passthrough,
    DropdownMenuContent: Passthrough,
    DropdownMenuItem: ({
      children,
      onClick,
    }: {
      children?: ReactNode;
      onClick?: () => void;
    }) => createElement("button", { type: "button", onClick }, children),
  };
});

import WalletButton from "./WalletButton";
import { WalletVerificationError } from "@/lib/wallet-verification";

let addressSeq = 0;
const connectWallet = () => {
  const address = `TestWa11et${String(++addressSeq).padStart(4, "0")}xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`;
  mocks.wallet.publicKey = { toBase58: () => address };
  return address;
};

const profileRow = (
  walletAddress: string | null,
  walletLocked = !!walletAddress,
) => ({
  data: [{ wallet_address: walletAddress, wallet_locked: walletLocked }],
  error: null,
});

const renderWithClient = (ui: ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrap = (node: ReactNode) => (
    <QueryClientProvider client={client}>{node}</QueryClientProvider>
  );
  const result = render(wrap(ui));
  return {
    ...result,
    rerender: (node: ReactNode) => result.rerender(wrap(node)),
  };
};

const declined = () =>
  new WalletVerificationError(
    "declined",
    "Signature request was declined — your wallet was not linked.",
  );

const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 20)));

describe("WalletButton wallet verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.wallet.connected = true;
    mocks.auth.user = { id: "user-1" };
  });
  afterEach(() => cleanup());

  it("waits for the linked-wallet state to load before verifying", async () => {
    const address = connectWallet();
    let resolveProfile!: (v: unknown) => void;
    mocks.rpc.mockReturnValue(new Promise((r) => (resolveProfile = r)));
    mocks.verifyWalletOwnership.mockResolvedValue(address);

    renderWithClient(<WalletButton />);
    await flush();
    expect(mocks.verifyWalletOwnership).not.toHaveBeenCalled();

    resolveProfile(profileRow(null));
    await waitFor(() =>
      expect(mocks.verifyWalletOwnership).toHaveBeenCalledTimes(1),
    );
    expect(mocks.verifyWalletOwnership).toHaveBeenCalledWith({
      walletAddress: address,
      signMessage: mocks.wallet.signMessage,
    });
  });

  it("does not verify when the profile read fails", async () => {
    connectWallet();
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "network down" },
    });

    renderWithClient(<WalletButton />);
    await flush();
    expect(mocks.verifyWalletOwnership).not.toHaveBeenCalled();
  });

  it("does not re-verify a wallet that is already linked", async () => {
    const address = connectWallet();
    mocks.rpc.mockResolvedValue(profileRow(address));

    renderWithClient(<WalletButton />);
    await flush();
    expect(mocks.verifyWalletOwnership).not.toHaveBeenCalled();
    expect(mocks.toast.error).not.toHaveBeenCalled();
  });

  it("does not verify a different wallet when the account already has one", async () => {
    connectWallet();
    mocks.rpc.mockResolvedValue(
      profileRow("LinkedWa11etxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"),
    );

    renderWithClient(<WalletButton />);
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalled());
    expect(mocks.verifyWalletOwnership).not.toHaveBeenCalled();
  });

  it("never writes the profile directly, even when signing is declined", async () => {
    connectWallet();
    mocks.rpc.mockResolvedValue(profileRow(null));
    mocks.verifyWalletOwnership.mockRejectedValue(
      new WalletVerificationError(
        "declined",
        "Signature request was declined — your wallet was not linked.",
      ),
    );

    renderWithClient(<WalletButton />);
    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith(
        "Signature request was declined — your wallet was not linked.",
        expect.anything(),
      ),
    );
    expect(mocks.toast.success).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("only links after the backend handshake succeeds, without a direct profile write", async () => {
    connectWallet();
    mocks.rpc.mockResolvedValue(profileRow(null));
    let finish!: (v: string) => void;
    mocks.verifyWalletOwnership.mockReturnValue(
      new Promise<string>((r) => (finish = r)),
    );

    renderWithClient(<WalletButton />);
    await waitFor(() =>
      expect(mocks.verifyWalletOwnership).toHaveBeenCalledTimes(1),
    );
    expect(mocks.toast.success).not.toHaveBeenCalled();

    finish(mocks.wallet.publicKey!.toBase58());
    await waitFor(() => expect(mocks.toast.success).toHaveBeenCalledTimes(1));
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("prompts once when several WalletButtons are mounted", async () => {
    connectWallet();
    mocks.rpc.mockResolvedValue(profileRow(null));
    mocks.verifyWalletOwnership.mockReturnValue(new Promise(() => {}));

    renderWithClient(
      <>
        <WalletButton />
        <WalletButton />
        <WalletButton />
      </>,
    );
    await waitFor(() => expect(mocks.verifyWalletOwnership).toHaveBeenCalled());
    await flush();
    expect(mocks.verifyWalletOwnership).toHaveBeenCalledTimes(1);
  });

  it("disconnect still works and never triggers verification", async () => {
    const address = connectWallet();
    mocks.rpc.mockResolvedValue(profileRow(address));
    mocks.wallet.disconnect.mockResolvedValue(undefined);

    renderWithClient(<WalletButton />);
    await flush();
    fireEvent.click(screen.getByText("Disconnect wallet"));

    await waitFor(() =>
      expect(mocks.toast.success).toHaveBeenCalledWith("Wallet disconnected"),
    );
    expect(mocks.wallet.disconnect).toHaveBeenCalledTimes(1);
    expect(mocks.verifyWalletOwnership).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("reports a failed disconnect", async () => {
    const address = connectWallet();
    mocks.rpc.mockResolvedValue(profileRow(address));
    mocks.wallet.disconnect.mockRejectedValue(new Error("adapter error"));

    renderWithClient(<WalletButton />);
    await flush();
    fireEvent.click(screen.getByText("Disconnect wallet"));

    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith("Failed to disconnect"),
    );
  });

  it("offers 'Verify wallet' after a decline and retries on click", async () => {
    connectWallet();
    mocks.rpc.mockResolvedValue(profileRow(null));
    mocks.verifyWalletOwnership.mockRejectedValueOnce(declined());

    renderWithClient(<WalletButton />);
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalled());
    expect(screen.getByTitle("Wallet not verified")).toBeInTheDocument();

    mocks.verifyWalletOwnership.mockResolvedValueOnce(
      mocks.wallet.publicKey!.toBase58(),
    );
    fireEvent.click(screen.getByText("Verify wallet"));

    await waitFor(() => expect(mocks.toast.success).toHaveBeenCalledTimes(1));
    expect(mocks.verifyWalletOwnership).toHaveBeenCalledTimes(2);
    expect(
      screen.getByTitle("Wallet linked to your account"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Verify wallet")).not.toBeInTheDocument();
  });

  it("does not re-prompt on remount after a decline (session guard)", async () => {
    connectWallet();
    mocks.rpc.mockResolvedValue(profileRow(null));
    mocks.verifyWalletOwnership.mockRejectedValue(declined());

    const first = renderWithClient(<WalletButton />);
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalled());
    first.unmount();

    renderWithClient(<WalletButton />);
    await flush();
    expect(mocks.verifyWalletOwnership).toHaveBeenCalledTimes(1);
  });

  it("re-prompts when the wallet is disconnected and reconnected", async () => {
    const address = connectWallet();
    mocks.rpc.mockResolvedValue(profileRow(null));
    mocks.verifyWalletOwnership.mockRejectedValue(declined());

    const view = renderWithClient(<WalletButton />);
    await waitFor(() =>
      expect(mocks.verifyWalletOwnership).toHaveBeenCalledTimes(1),
    );

    mocks.wallet.connected = false;
    mocks.wallet.publicKey = null;
    view.rerender(<WalletButton />);
    await flush();

    mocks.wallet.connected = true;
    mocks.wallet.publicKey = { toBase58: () => address };
    view.rerender(<WalletButton />);
    await waitFor(() =>
      expect(mocks.verifyWalletOwnership).toHaveBeenCalledTimes(2),
    );
  });

  it("re-reads the linked wallet on reconnect, so a wallet unlinked elsewhere gets verified", async () => {
    const address = connectWallet();
    mocks.rpc.mockResolvedValue(profileRow(address));
    mocks.verifyWalletOwnership.mockResolvedValue(address);

    const view = renderWithClient(<WalletButton />);
    await flush();
    expect(mocks.verifyWalletOwnership).not.toHaveBeenCalled();

    // Unlinked in Settings while this button stayed mounted.
    mocks.rpc.mockResolvedValue(profileRow(null));
    mocks.wallet.connected = false;
    mocks.wallet.publicKey = null;
    view.rerender(<WalletButton />);
    await flush();
    mocks.wallet.connected = true;
    mocks.wallet.publicKey = { toBase58: () => address };
    view.rerender(<WalletButton />);

    await waitFor(() =>
      expect(mocks.verifyWalletOwnership).toHaveBeenCalledTimes(1),
    );
  });

  it("a manual retry while a verification is in flight doesn't prompt twice (in-flight guard)", async () => {
    connectWallet();
    mocks.rpc.mockResolvedValue(profileRow(null));
    mocks.verifyWalletOwnership.mockReturnValue(new Promise(() => {}));

    renderWithClient(
      <>
        <WalletButton />
        <WalletButton />
      </>,
    );
    await waitFor(() =>
      expect(mocks.verifyWalletOwnership).toHaveBeenCalledTimes(1),
    );

    // The instance that didn't start the auto-prompt still offers the item.
    fireEvent.click(screen.getAllByText("Verify wallet")[0]);
    await flush();
    expect(mocks.verifyWalletOwnership).toHaveBeenCalledTimes(1);
  });

  it("treats an 'already linked' response as linked, without an error", async () => {
    connectWallet();
    mocks.rpc.mockResolvedValue(profileRow(null));
    mocks.verifyWalletOwnership.mockRejectedValue(
      new WalletVerificationError(
        "rejected",
        "This wallet is already linked to your account.",
        "already_linked",
      ),
    );

    renderWithClient(<WalletButton />);
    await waitFor(() =>
      expect(
        screen.getByTitle("Wallet linked to your account"),
      ).toBeInTheDocument(),
    );
    expect(mocks.toast.error).not.toHaveBeenCalled();
  });

  it("does nothing while no wallet is connected", async () => {
    mocks.wallet.connected = false;
    mocks.wallet.publicKey = null;
    mocks.rpc.mockResolvedValue(profileRow(null));

    renderWithClient(<WalletButton />);
    await flush();
    expect(mocks.verifyWalletOwnership).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
