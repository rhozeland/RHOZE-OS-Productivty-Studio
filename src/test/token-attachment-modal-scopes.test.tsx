import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AttachCoinLauncher from "@/components/coin/AttachCoinLauncher";
import WorksLightbox from "@/components/creators/WorksLightbox";

const walletModalState = vi.hoisted(() => {
  let visible = false;
  const subscribers = new Set<() => void>();

  return {
    getSnapshot: () => visible,
    subscribe: (subscriber: () => void) => {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    setVisible: (nextVisible: boolean) => {
      visible = nextVisible;
      subscribers.forEach((subscriber) => subscriber());
    },
  };
});

vi.mock("@solana/wallet-adapter-react-ui", async () => {
  const React = await import("react");
  return {
    useWalletModal: () => ({
      visible: React.useSyncExternalStore(
        walletModalState.subscribe,
        walletModalState.getSnapshot,
        walletModalState.getSnapshot,
      ),
      setVisible: walletModalState.setVisible,
    }),
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    switch (queryKey[0]) {
      case "works-lightbox":
        return {
          data: [{
            id: "work-1",
            title: "Test Work",
            file_url: null,
            mime_type: null,
            kind: "audio",
            visibility: "public",
            is_unverified: false,
            anchored_at: null,
            created_at: "2026-01-01T00:00:00.000Z",
            user_id: "creator-1",
            linked_token_id: null,
            linked_token_mint: null,
          }],
          isLoading: false,
        };
      case "works-locked-count":
        return { data: 0, isLoading: false };
      case "launcher-projects":
        return {
          data: [{ id: "project-1", title: "Test Project", linked_token_id: null, linked_token_mint: null }],
          isLoading: false,
        };
      case "launcher-works":
      case "approved-creator-tokens":
        return { data: [], isLoading: false, isError: false };
      default:
        return { data: null, isLoading: false, isError: false };
    }
  },
  useMutation: (options: {
    mutationFn: () => Promise<unknown>;
    onSuccess?: (result: unknown) => void;
    onError?: (error: unknown) => void;
  }) => ({
    isPending: false,
    mutate: () => {
      void options.mutationFn().then(
        (result) => options.onSuccess?.(result),
        (error: unknown) => options.onError?.(error),
      );
    },
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "creator-1" } }),
}));

vi.mock("@/hooks/useTokenAttachment", () => ({
  useTokenAttachment: () => ({
    attachApproved: vi.fn(),
    attachExternal: async () => {
      walletModalState.setVisible(true);
      throw new Error("Wallet connection required");
    },
    unlink: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const addWalletChooser = () => {
  const modal = document.createElement("div");
  modal.className = "wallet-adapter-modal";
  const list = document.createElement("div");
  list.className = "wallet-adapter-modal-list";
  const option = document.createElement("button");
  option.textContent = "Wallet option";
  list.append(option);
  modal.append(list);
  document.body.append(modal);
  return { modal, option };
};

describe("wallet chooser modal scopes", () => {
  beforeEach(() => walletModalState.setVisible(false));

  afterEach(() => {
    cleanup();
    document.querySelectorAll(".wallet-adapter-modal").forEach((modal) => modal.remove());
    vi.unstubAllGlobals();
    walletModalState.setVisible(false);
  });

  it("releases the Project launcher scope without losing its selected project", async () => {
    const { option } = addWalletChooser();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        symbol: "TEST",
        name: "Test Coin",
        imageUri: null,
        priceUsd: 1,
        marketCapUsd: 1000,
        change24h: 2,
        holderCount: 10,
      }),
    }));

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AttachCoinLauncher open onOpenChange={vi.fn()} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText(/Contract address/), {
      target: { value: "11111111111111111111111111111111" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    fireEvent.click(await screen.findByRole("button", { name: /Release/ }));
    fireEvent.click(screen.getByTitle("Test Project"));
    fireEvent.click(screen.getByRole("button", { name: "Attach $TEST" }));

    await waitFor(() => expect(walletModalState.getSnapshot()).toBe(true));
    act(() => option.focus());

    expect(option).toHaveFocus();
    expect(option.closest('[aria-hidden="true"]')).toBeNull();
    expect(screen.getByRole("heading", { name: /Which release gets \$TEST/ })).toBeInTheDocument();
    expect(screen.getByTitle("Test Project")).toBeInTheDocument();
    expect(screen.getByTitle("Test Project").querySelector(".lucide-check")).toBeInTheDocument();
  });

  it("releases the Work lightbox scope while preserving the attachment form", async () => {
    const { option } = addWalletChooser();

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <WorksLightbox open onOpenChange={vi.fn()} userId="creator-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Attach coin/ }));
    fireEvent.click(screen.getByRole("button", { name: /External pump.fun token/ }));
    const mintInput = screen.getByLabelText("Pump.fun mint address");
    fireEvent.change(mintInput, { target: { value: "11111111111111111111111111111111" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify creator wallet and attach/ }));

    await waitFor(() => expect(option).toHaveFocus());

    expect(option.closest('[aria-hidden="true"]')).toBeNull();
    expect(screen.getByRole("heading", { name: "Works" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Attach a token" })).not.toBeInTheDocument();

    act(() => walletModalState.setVisible(false));
    expect(await screen.findByLabelText("Pump.fun mint address")).toHaveValue("11111111111111111111111111111111");
  });
});
