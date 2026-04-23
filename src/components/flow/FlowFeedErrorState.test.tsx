/**
 * FlowFeedErrorState component tests.
 *
 * Verifies the friendly error UI shown when Flow Mode's feed loader (or
 * its profiles_public lookup) fails — that the headline is user-readable,
 * the underlying error message is surfaced for support diagnostics, and
 * the "Try again" button correctly invokes the retry callback.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FlowFeedErrorState from "./FlowFeedErrorState";

describe("FlowFeedErrorState", () => {
  it("renders the friendly headline + message", () => {
    render(<FlowFeedErrorState error={new Error("boom")} />);
    expect(
      screen.getByRole("heading", { name: /couldn't load the feed/i }),
    ).toBeInTheDocument();
    // The body copy reassures the user this is recoverable.
    expect(screen.getByText(/usually temporary/i)).toBeInTheDocument();
  });

  it("uses role='alert' so screen readers announce the failure", () => {
    render(<FlowFeedErrorState error={new Error("boom")} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("surfaces the underlying error message in the muted detail line", () => {
    render(<FlowFeedErrorState error={new Error("profiles_public RLS denied")} />);
    expect(
      screen.getByTestId("flow-feed-error-detail"),
    ).toHaveTextContent(/profiles_public RLS denied/);
  });

  it("falls back to a generic detail when the error has no message", () => {
    render(<FlowFeedErrorState error={null} />);
    expect(
      screen.getByTestId("flow-feed-error-detail"),
    ).toHaveTextContent(/Unknown error/i);
  });

  it("handles supabase-style { message } error objects", () => {
    render(<FlowFeedErrorState error={{ message: "rate limited" }} />);
    expect(
      screen.getByTestId("flow-feed-error-detail"),
    ).toHaveTextContent(/rate limited/i);
  });

  it("invokes onRetry when 'Try again' is clicked", () => {
    const onRetry = vi.fn();
    render(<FlowFeedErrorState error={new Error("x")} onRetry={onRetry} />);
    fireEvent.click(screen.getByTestId("flow-feed-error-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("hides the retry button when no onRetry is provided", () => {
    render(<FlowFeedErrorState error={new Error("x")} />);
    expect(
      screen.queryByTestId("flow-feed-error-retry"),
    ).not.toBeInTheDocument();
  });

  it("shows a 'Retrying…' label and disables the button while retrying", () => {
    const onRetry = vi.fn();
    render(
      <FlowFeedErrorState
        error={new Error("x")}
        onRetry={onRetry}
        isRetrying
      />,
    );
    const button = screen.getByTestId("flow-feed-error-retry");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/retrying/i);
  });
});
