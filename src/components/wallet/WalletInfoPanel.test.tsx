import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  pendingChange: null as null | { id: string; requested_wallet: string; created_at: string },
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mocks.rpc(...args),
    from: (...args: unknown[]) => mocks.from(...args),
  },
}));
vi.mock("@/components/WalletButton", () => ({ default: () => <button type="button">Wallet</button> }));
vi.mock("@/components/settings/ClaimLimitsControl", () => ({ default: () => null }));

import WalletInfoPanel from "./WalletInfoPanel";

const LINKED = "LinkedWa11etxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const REQUESTED = "RequestedWa11etxxxxxxxxxxxxxxxxxxxxxxxxxyz9";

// supabase.from("wallet_change_requests") read of the pending change.
const pendingChangeQuery = () => {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: () => Promise.resolve({ data: mocks.pendingChange, error: null }),
  };
  return query;
};

const renderPanel = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <WalletInfoPanel />
    </QueryClientProvider>,
  );

describe("WalletInfoPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pendingChange = null;
    mocks.from.mockImplementation((table: string) =>
      table === "wallet_change_requests" ? pendingChangeQuery() : undefined,
    );
  });
  afterEach(() => cleanup());

  it("shows the linked wallet without any control that clears it", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ wallet_address: LINKED }], error: null });

    renderPanel();

    expect(await screen.findByText(LINKED)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /disconnect/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Request wallet change/)).toBeInTheDocument();
    expect(mocks.from).not.toHaveBeenCalledWith("profiles");
  });

  it("tells the user a wallet change is waiting for review", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ wallet_address: LINKED }], error: null });
    mocks.pendingChange = {
      id: "request-1",
      requested_wallet: REQUESTED,
      created_at: "2026-11-18T00:00:00.000Z",
    };

    renderPanel();

    expect(await screen.findByText(/is waiting for admin review/)).toBeInTheDocument();
    expect(screen.getByText("Reques…xyz9")).toBeInTheDocument();
    expect(screen.getByText(LINKED)).toBeInTheDocument();
  });
});
