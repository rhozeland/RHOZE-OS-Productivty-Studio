import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  disconnect: vi.fn(),
  invalidateQueries: vi.fn(),
  setVisible: vi.fn(),
  signMessage: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  verifyWalletOwnership: vi.fn(),
  walletAddress: "7YttLkHdoNj9wyDur5V8Z7m2kHm6xW" + "111111111111111111",
  linkedAddress: null as string | null,
}));

vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => ({
    publicKey: { toBase58: () => mocks.walletAddress },
    connected: true,
    disconnect: mocks.disconnect,
    signMessage: mocks.signMessage,
  }),
}));

vi.mock("@solana/wallet-adapter-react-ui", () => ({
  useWalletModal: () => ({ setVisible: mocks.setVisible }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: { walletAddress: mocks.linkedAddress },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "test-user" } }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock("@/lib/verifyWalletOwnership", () => ({
  verifyWalletOwnership: mocks.verifyWalletOwnership,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open: boolean;
  }) => open ? <div role="dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  AlertDialogAction: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

import WalletButton from "./WalletButton";

describe("WalletButton wallet-linking flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.linkedAddress = null;
  });

  it("explains signing, verifies the wallet, and refreshes profile queries on success", async () => {
    mocks.verifyWalletOwnership.mockResolvedValue({
      verified: true,
      walletAddress: mocks.walletAddress,
    });
    mocks.invalidateQueries.mockResolvedValue(undefined);

    render(<WalletButton />);

    fireEvent.click(screen.getByRole("button", { name: /verify and link wallet/i }));

    expect(
      screen.getByRole("heading", { name: "Verify and link this wallet?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/free off-chain message/i)).toBeInTheDocument();
    expect(screen.getByText(/does not send a transaction or spend sol/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign and verify" }));

    await waitFor(() => {
      expect(mocks.verifyWalletOwnership).toHaveBeenCalledWith({
        walletAddress: mocks.walletAddress,
        signMessage: mocks.signMessage,
        intent: "link",
      });
    });
    await waitFor(() => {
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["wallet-binding", "test-user"],
      });
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["my-profile"],
      });
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Wallet verified and linked to your account.",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("surfaces signature cancellation and leaves linked-wallet data unchanged", async () => {
    mocks.verifyWalletOwnership.mockRejectedValue(new Error("User rejected request"));

    render(<WalletButton />);
    fireEvent.click(screen.getByRole("button", { name: /verify and link wallet/i }));
    fireEvent.click(screen.getByRole("button", { name: "Sign and verify" }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("User rejected request");
    });
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("surfaces verification errors returned by the server", async () => {
    mocks.verifyWalletOwnership.mockRejectedValue(
      new Error("This wallet is already linked to another Rhozeland account."),
    );

    render(<WalletButton />);
    fireEvent.click(screen.getByRole("button", { name: /verify and link wallet/i }));
    fireEvent.click(screen.getByRole("button", { name: "Sign and verify" }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "This wallet is already linked to another Rhozeland account.",
      );
    });
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
  });
});
