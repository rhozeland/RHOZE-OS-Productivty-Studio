import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import TokenAttachmentDialog from "@/components/coin/TokenAttachmentDialog";
import { WalletSignatureRejectedError } from "@/lib/token-attachment";

const mocks = vi.hoisted(() => ({
  attachApproved: vi.fn(),
  attachExternal: vi.fn(),
  unlink: vi.fn(),
  from: vi.fn(),
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/hooks/useTokenAttachment", () => ({
  useTokenAttachment: () => ({
    attachApproved: mocks.attachApproved,
    attachExternal: mocks.attachExternal,
    unlink: mocks.unlink,
    isPending: false,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "creator-id" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("sonner", () => ({ toast: {
  success: mocks.toastSuccess,
  info: mocks.toastInfo,
  error: mocks.toastError,
} }));

const approvedToken = {
  id: "approved-token-id",
  mint_address: "ApprovedMint1111111111111111111111111111111",
  ticker: "APPROVED",
  name: "Approved Coin",
  is_primary: true,
};

const makeQueryBuilder = (tokens: typeof approvedToken[] = [approvedToken]) => {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    update: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: tokens, error: null }).then(resolve),
  };
  return builder;
};

const renderDialog = (targetType: "project" | "work", onOpenChange = vi.fn()) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const attachment = {
    attachApproved: mocks.attachApproved,
    attachExternal: mocks.attachExternal,
    unlink: mocks.unlink,
    isPending: false,
  } as any;
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TokenAttachmentDialog
          open
          onOpenChange={onOpenChange}
          targetType={targetType}
          targetId="target-id"
          attachment={attachment}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, onOpenChange };
};

describe("TokenAttachmentDialog", () => {
  beforeEach(() => {
    mocks.attachApproved.mockReset();
    mocks.attachExternal.mockReset();
    mocks.unlink.mockReset();
    mocks.from.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastInfo.mockReset();
    mocks.toastError.mockReset();
    mocks.from.mockReturnValue(makeQueryBuilder());
  });

  afterEach(() => vi.restoreAllMocks());

  it.each(["project", "work"] as const)("attaches an approved token to a %s through its RPC handler", async (targetType) => {
    mocks.attachApproved.mockResolvedValue(true);
    const { onOpenChange } = renderDialog(targetType);

    fireEvent.click(screen.getByRole("button", { name: /Approved token/i }));
    fireEvent.click(await screen.findByRole("button", { name: /\$APPROVED · Approved Coin/i }));

    await waitFor(() => expect(mocks.attachApproved).toHaveBeenCalledWith({
      tokenId: approvedToken.id,
      targetType,
      targetId: "target-id",
    }));
    expect(mocks.attachExternal).not.toHaveBeenCalled();
    expect(mocks.from.mock.results[0]?.value.update).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it.each(["project", "work"] as const)("attaches an external mint to a %s through the challenge flow", async (targetType) => {
    mocks.attachExternal.mockResolvedValue({ token: { mint: "verified-mint", ticker: "VERIFIED" } });
    renderDialog(targetType);

    fireEvent.click(screen.getByRole("button", { name: /External pump.fun token/i }));
    fireEvent.change(screen.getByLabelText(/Pump.fun mint address/i), { target: { value: "Mint111111111111111111111111111111111111111" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify creator wallet and attach/i }));

    await waitFor(() => expect(mocks.attachExternal).toHaveBeenCalledWith({
      mintAddress: "Mint111111111111111111111111111111111111111",
      targetType,
      targetId: "target-id",
    }));
    expect(mocks.attachApproved).not.toHaveBeenCalled();
    expect(mocks.from.mock.results[0]?.value.update).not.toHaveBeenCalled();
  });

  it("shows the missing-approved-token state without falling back to external attachment", async () => {
    mocks.from.mockReturnValue(makeQueryBuilder([]));
    renderDialog("project");

    fireEvent.click(screen.getByRole("button", { name: /Approved token/i }));
    expect(await screen.findByText(/do not have any approved creator tokens/i)).toBeInTheDocument();
    expect(mocks.attachApproved).not.toHaveBeenCalled();
    expect(mocks.attachExternal).not.toHaveBeenCalled();
  });

  it("reports a rejected wallet signature without treating it as an attachment", async () => {
    mocks.attachExternal.mockRejectedValue(new WalletSignatureRejectedError());
    renderDialog("work");

    fireEvent.click(screen.getByRole("button", { name: /External pump.fun token/i }));
    fireEvent.change(screen.getByLabelText(/Pump.fun mint address/i), { target: { value: "Mint111111111111111111111111111111111111111" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify creator wallet and attach/i }));

    await waitFor(() => expect(mocks.toastInfo).toHaveBeenCalledWith("Wallet signature canceled. No token was attached."));
  });

  it("reports an external backend failure in the UI", async () => {
    mocks.attachExternal.mockRejectedValue(new Error("External verification service unavailable"));
    renderDialog("project");

    fireEvent.click(screen.getByRole("button", { name: /External pump.fun token/i }));
    fireEvent.change(screen.getByLabelText(/Pump.fun mint address/i), { target: { value: "Mint111111111111111111111111111111111111111" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify creator wallet and attach/i }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("External verification service unavailable"));
  });
});
