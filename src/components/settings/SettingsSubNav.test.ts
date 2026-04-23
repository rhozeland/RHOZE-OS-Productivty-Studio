/**
 * Tests for the SettingsSubNav pure helpers.
 *
 * The component itself is presentational and exercised through normal
 * page rendering; here we lock in the synthetic-path builder so the
 * shared `resolveNavLink` resolver always receives the format it expects.
 */
import { describe, it, expect } from "vitest";
import { buildSyntheticPath } from "./SettingsSubNav";

describe("buildSyntheticPath", () => {
  it("uses the hash fragment as the section id", () => {
    expect(buildSyntheticPath("#wallet", "profile")).toBe("/settings/wallet");
  });

  it("trims surrounding whitespace from the hash", () => {
    expect(buildSyntheticPath("#  wallet  ", "profile")).toBe(
      "/settings/wallet",
    );
  });

  it("falls back to the default id when the hash is empty", () => {
    expect(buildSyntheticPath("", "profile")).toBe("/settings/profile");
  });

  it("falls back when only the # marker is present", () => {
    expect(buildSyntheticPath("#", "profile")).toBe("/settings/profile");
  });

  it("strips leading # only once (does not eat repeated markers)", () => {
    // A double-hash is a malformed URL; we should preserve enough info
    // for the resolver to fail-safely fall through to the default.
    expect(buildSyntheticPath("##weird", "profile")).toBe(
      "/settings/#weird",
    );
  });
});
