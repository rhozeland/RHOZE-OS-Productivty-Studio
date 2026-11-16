import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
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

const renderPanel = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <WalletInfoPanel />
    </QueryClientProvider>,
  );

describe("WalletInfoPanel", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("shows the linked wallet without any control that clears it", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ wallet_address: LINKED }], error: null });

    renderPanel();

    expect(await screen.findByText(LINKED)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /disconnect/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Request wallet change/)).toBeInTheDocument();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
