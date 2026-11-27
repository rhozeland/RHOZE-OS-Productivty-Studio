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
 * menu items can be clicked. The only table it may read is
 * wallet_change_requests, for the user's pending change.
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
  pendingChange: null as null | {
    id: string;
    requested_wallet: string;
    created_at: string;
  },
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

// supabase.from("wallet_change_requests") read of the pending change.
const pendingChangeQuery = () => {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: () =>
      Promise.resolve({ data: mocks.pendingChange, error: null }),
  };
  return query;
};

const pendingRow = (requestedWallet: string) => ({
  id: "request-1",
  requested_wallet: requestedWallet,
  created_at: "2026-11-18T00:00:00.000Z",
});

const LINKED = "LinkedWa11etxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

describe("WalletButton wallet verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.wallet.connected = true;
    mocks.auth.user = { id: "user-1" };
    mocks.pendingChange = null;
    mocks.from.mockImplementation((table: string) =>
      table === "wallet_change_requests" ? pendingChangeQuery() : undefined,
    );
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

  it("does nothing for the wallet that is already linked", async () => {
    const address = connectWallet();
    mocks.rpc.mockResolvedValue(profileRow(address));

    renderWithClient(<WalletButton />);
    await flush();
    expect(mocks.verifyWalletOwnership).not.toHaveBeenCalled();
    expect(mocks.toast.error).not.toHaveBeenCalled();
    expect(screen.queryByText("Verify wallet")).not.toBeInTheDocument();
    expect(screen.queryByText("Request wallet change")).not.toBeInTheDocument();
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
    expect(mocks.from).not.toHaveBeenCalledWith("profiles");
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
    expect(mocks.from).not.toHaveBeenCalledWith("profiles");
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

  it("offers 'Request wallet change' when a different wallet is connected, without writing the profile", async () => {
    const address = connectWallet();
    mocks.rpc.mockResolvedValue(profileRow(LINKED));
    mocks.verifyWalletOwnership.mockImplementation(async () => {
      mocks.pendingChange = pendingRow(address);
      return address;
    });

    renderWithClient(<WalletButton />);
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalled());
    expect(mocks.verifyWalletOwnership).not.toHaveBeenCalled();
    expect(screen.queryByText("Verify wallet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Request wallet change"));

    await waitFor(() =>
      expect(mocks.toast.success).toHaveBeenCalledWith("Wallet change requested. An admin will review it.", expect.anything()),
    );
    expect(mocks.verifyWalletOwnership).toHaveBeenCalledTimes(1);
    expect(mocks.verifyWalletOwnership).toHaveBeenCalledWith({
      walletAddress: address,
      signMessage: mocks.wallet.signMessage,
      intent: "change",
    });
    // The wallet stays unlinked until an admin approves; the menu now shows
    // the pending request instead of offering a second one.
    await waitFor(() =>
      expect(
        screen.getByTitle("Wallet change pending admin review"),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByTitle("Wallet linked to your account")).not.toBeInTheDocument();
    expect(screen.queryByText("Request wallet change")).not.toBeInTheDocument();
    expect(screen.getByText("Change pending review")).toBeInTheDocument();
    // Only the first mismatch warning; none for the wallet just requested.
    expect(mocks.toast.error).toHaveBeenCalledTimes(1);
    expect(mocks.from).not.toHaveBeenCalledWith("profiles");
  });

  it("shows the requested wallet as pending review, without a mismatch warning", async () => {
    const address = connectWallet();
    mocks.rpc.mockResolvedValue(profileRow(LINKED));
    mocks.pendingChange = pendingRow(address);

    renderWithClient(<WalletButton />);
    await waitFor(() =>
      expect(
        screen.getByTitle("Wallet change pending admin review"),
      ).toBeInTheDocument(),
    );
    await flush();
    expect(screen.getByText("Change pending review")).toBeInTheDocument();
    expect(screen.queryByText("Request wallet change")).not.toBeInTheDocument();
    expect(mocks.toast.error).not.toHaveBeenCalled();
    expect(mocks.verifyWalletOwnership).not.toHaveBeenCalled();
  });

  it("doesn't offer another change while one is pending for a different wallet", async () => {
    connectWallet();
    mocks.rpc.mockResolvedValue(profileRow(LINKED));
    mocks.pendingChange = pendingRow("RequestedWa11etxxxxxxxxxxxxxxxxxxxxxxxxxxx");

    renderWithClient(<WalletButton />);
    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith(
        expect.stringContaining("waiting for admin review"),
        expect.anything(),
      ),
    );
    expect(mocks.toast.error).not.toHaveBeenCalledWith(
      expect.stringContaining("Request wallet change"),
      expect.anything(),
    );
    expect(screen.getByTitle("Wallet not verified")).toBeInTheDocument();
    expect(screen.getByText("Change pending review")).toBeInTheDocument();
    expect(screen.queryByText("Request wallet change")).not.toBeInTheDocument();
  });

  it("picks up a pending change the backend reports, so the request isn't offered again", async () => {
    const address = connectWallet();
    mocks.rpc.mockResolvedValue(profileRow(LINKED));
    mocks.verifyWalletOwnership.mockImplementation(async () => {
      // Filed from another tab or device since this page loaded.
      mocks.pendingChange = pendingRow(address);
      throw new WalletVerificationError(
        "rejected",
        "You already have a wallet change waiting for review.",
        "change_pending",
      );
    });

    renderWithClient(<WalletButton />);
    fireEvent.click(await screen.findByText("Request wallet change"));

    await waitFor(() =>
      expect(screen.getByText("Change pending review")).toBeInTheDocument(),
    );
    expect(mocks.toast.error).toHaveBeenCalledWith(
      "You already have a wallet change waiting for review.",
      expect.anything(),
    );
    expect(screen.queryByText("Request wallet change")).not.toBeInTheDocument();
  });

  it("does nothing while no wallet is connected", async () => {
    mocks.wallet.connected = false;
    mocks.wallet.publicKey = null;
    mocks.rpc.mockResolvedValue(profileRow(null));

    renderWithClient(<WalletButton />);
    await flush();
    expect(mocks.verifyWalletOwnership).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalledWith("profiles");
  });
});
