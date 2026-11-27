import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * Admins review wallet change requests here. Decisions must go through the
 * process_wallet_change RPC (the table has no UPDATE policy), and its
 * refusals must tell the admin what to do next.
 */

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  requests: [] as Record<string, unknown>[],
  statusFilters: [] as unknown[],
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.from(...args),
    rpc: (...args: unknown[]) => mocks.rpc(...args),
  },
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import AdminWalletChangeRequests from "./AdminWalletChangeRequests";
import { describeWalletChangeError } from "@/lib/wallet-change-errors";

// Chainable, awaitable stand-in for a supabase-js select.
const query = (result: () => unknown, onEq?: (column: string, value: unknown) => void) => {
  const q = {
    select: () => q,
    order: () => q,
    in: () => q,
    eq: (column: string, value: unknown) => {
      onEq?.(column, value);
      return q;
    },
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve, reject),
  };
  return q;
};

const CURRENT = "CurrentWa11etxxxxxxxxxxxxxxxxxxxxxxxxxxx1234";
const REQUESTED = "RequestedWa11etxxxxxxxxxxxxxxxxxxxxxxxxx5678";

const request = (overrides: Record<string, unknown> = {}) => ({
  id: "request-1",
  user_id: "user-1",
  current_wallet: CURRENT,
  requested_wallet: REQUESTED,
  reason: null,
  status: "pending",
  admin_note: null,
  verification_id: "challenge-1",
  processed_at: null,
  created_at: "2026-11-18T00:00:00.000Z",
  ...overrides,
});

const openFirstRequest = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Review request from Ada" }));
  return screen.findByRole("dialog");
};

describe("AdminWalletChangeRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requests = [request()];
    mocks.statusFilters = [];
    mocks.from.mockImplementation((table: string) =>
      table === "wallet_change_requests"
        ? query(
            () => ({ data: mocks.requests, error: null }),
            (column, value) => column === "status" && mocks.statusFilters.push(value),
          )
        : query(() => ({
            data: [{ user_id: "user-1", display_name: "Ada", username: "ada" }],
            error: null,
          })),
    );
    mocks.rpc.mockResolvedValue({ data: null, error: null });
  });
  afterEach(() => cleanup());

  it("lists pending requests with the user and both wallets", async () => {
    render(<AdminWalletChangeRequests />);

    expect(await screen.findByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Curren…1234")).toBeInTheDocument();
    expect(screen.getByText("Reques…5678")).toBeInTheDocument();
    expect(mocks.statusFilters).toEqual(["pending"]);
  });

  it("approves through process_wallet_change with the admin's note", async () => {
    render(<AdminWalletChangeRequests />);
    await openFirstRequest();

    fireEvent.change(screen.getByPlaceholderText(/Optional note/), {
      target: { value: "Confirmed with the creator" },
    });
    mocks.requests = [];
    fireEvent.click(screen.getByRole("button", { name: /Approve/ }));

    await waitFor(() =>
      expect(mocks.toast.success).toHaveBeenCalledWith("Wallet change approved"),
    );
    expect(mocks.rpc).toHaveBeenCalledWith("process_wallet_change", {
      _request_id: "request-1",
      _approve: true,
      _note: "Confirmed with the creator",
    });
    expect(await screen.findByText("No requests.")).toBeInTheDocument();
  });

  it("rejects through process_wallet_change", async () => {
    render(<AdminWalletChangeRequests />);
    await openFirstRequest();

    fireEvent.click(screen.getByRole("button", { name: /Reject/ }));

    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("process_wallet_change", {
        _request_id: "request-1",
        _approve: false,
        _note: undefined,
      }),
    );
    expect(mocks.toast.success).toHaveBeenCalledWith("Wallet change rejected");
  });

  it("tells the admin to reject when the wallet was linked elsewhere meanwhile", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "profiles_wallet_address_key"',
      },
    });
    render(<AdminWalletChangeRequests />);
    await openFirstRequest();

    fireEvent.click(screen.getByRole("button", { name: /Approve/ }));

    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith(
        "The requested wallet is now linked to another account. Reject this request.",
      ),
    );
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });

  it("can't approve a request that has no ownership proof, but can reject it", async () => {
    mocks.requests = [request({ verification_id: null })];
    render(<AdminWalletChangeRequests />);
    await openFirstRequest();

    expect(screen.getByText(/No ownership proof is on file/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Approve/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Reject/ })).toBeEnabled();
  });

  it("shows processed requests without decision buttons", async () => {
    mocks.requests = [
      request({ status: "rejected", admin_note: "Wrong wallet", processed_at: "2026-11-18T01:00:00.000Z" }),
    ];
    render(<AdminWalletChangeRequests />);
    await openFirstRequest();

    expect(screen.getByText("Wrong wallet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reject/ })).not.toBeInTheDocument();
  });
});

describe("describeWalletChangeError", () => {
  it.each([
    [{ message: "Requested wallet has not been verified by its owner" }, /never verified/],
    [{ message: "Linked wallet changed since the request was made" }, /linked wallet changed/],
    [{ message: "Request not found or already processed" }, /already processed/],
    [{ message: "something else" }, /something else/],
  ])("explains %o", (error, expected) => {
    expect(describeWalletChangeError(error)).toMatch(expected);
  });
});
