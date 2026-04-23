import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FlowScopeToggle, type FlowScope } from "./FlowScopeToggle";

/**
 * The Flow Mode scope toggle ("For You" / "All") sits above both the swipe
 * deck and the browse grid. These tests pin down the rules that drive which
 * badge reads as active so a future refactor can't silently swap the labels
 * or break the aria semantics that screen readers rely on.
 *
 * The component is rendered the same way in both view modes, so verifying
 * the render contract once is enough to cover both swipe and browse cards.
 * We mark each test with the view mode it represents so failures point
 * back to the user-visible scenario.
 */

const renderToggle = (
  scope: FlowScope,
  {
    visible = true,
    onScopeChange = vi.fn(),
  }: { visible?: boolean; onScopeChange?: (s: FlowScope) => void } = {},
) =>
  render(
    <TooltipProvider>
      <FlowScopeToggle
        scope={scope}
        onScopeChange={onScopeChange}
        visible={visible}
      />
    </TooltipProvider>,
  );

describe("FlowScopeToggle", () => {
  afterEach(() => cleanup());

  describe("swipe view (deck above the cards)", () => {
    it("marks 'For You' active and 'All' inactive when scope is preferred", () => {
      renderToggle("preferred");

      const forYou = screen.getByRole("button", { name: /preferred categories/i });
      const all = screen.getByRole("button", { name: /every category/i });

      expect(forYou).toHaveAttribute("aria-pressed", "true");
      expect(all).toHaveAttribute("aria-pressed", "false");
      expect(forYou).toHaveTextContent("For You");
      expect(all).toHaveTextContent("All");
    });

    it("marks 'All' active and 'For You' inactive when scope is all", () => {
      renderToggle("all");

      const forYou = screen.getByRole("button", { name: /preferred categories/i });
      const all = screen.getByRole("button", { name: /every category/i });

      expect(all).toHaveAttribute("aria-pressed", "true");
      expect(forYou).toHaveAttribute("aria-pressed", "false");
    });

    it("applies the active style only to the selected scope button", () => {
      renderToggle("preferred");

      const forYou = screen.getByRole("button", { name: /preferred categories/i });
      const all = screen.getByRole("button", { name: /every category/i });

      expect(forYou.className).toContain("bg-primary");
      expect(all.className).not.toContain("bg-primary");
    });
  });

  describe("browse view (grid above the cards)", () => {
    // Browse mode renders the *same* toggle component above the masonry grid.
    // Re-running the contract here documents that both modes share the
    // badge semantics, so a regression in either surface fails a test.

    it("renders both scope options regardless of view mode", () => {
      renderToggle("all");

      expect(
        screen.getByRole("button", { name: /preferred categories/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /every category/i }),
      ).toBeInTheDocument();
    });

    it("flips the active badge when scope changes between renders", () => {
      const { rerender } = renderToggle("preferred");

      expect(
        screen.getByRole("button", { name: /preferred categories/i }),
      ).toHaveAttribute("aria-pressed", "true");

      rerender(
        <TooltipProvider>
          <FlowScopeToggle
            scope="all"
            onScopeChange={() => {}}
            visible
          />
        </TooltipProvider>,
      );

      expect(
        screen.getByRole("button", { name: /every category/i }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(
        screen.getByRole("button", { name: /preferred categories/i }),
      ).toHaveAttribute("aria-pressed", "false");
    });
  });

  describe("visibility guard", () => {
    it("renders nothing when visible is false (no calibrated preferences)", () => {
      const { container } = renderToggle("preferred", { visible: false });
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("interactions", () => {
    it("invokes onScopeChange with the clicked scope", async () => {
      const onScopeChange = vi.fn();
      renderToggle("preferred", { onScopeChange });

      screen.getByRole("button", { name: /every category/i }).click();
      expect(onScopeChange).toHaveBeenCalledWith("all");

      screen.getByRole("button", { name: /preferred categories/i }).click();
      expect(onScopeChange).toHaveBeenCalledWith("preferred");
    });
  });
});
