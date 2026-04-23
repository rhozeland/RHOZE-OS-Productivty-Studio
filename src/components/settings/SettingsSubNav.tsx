import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveNavLink } from "@/hooks/useNavLink";

/**
 * Settings sub-navigation
 * ─────────────────────────────────────────────────────────────────────────
 * A reusable sub-nav for the Settings page. Renders both a sticky desktop
 * sidebar and a horizontally-scrolling mobile pill bar from a single
 * SECTIONS array.
 *
 * Why anchor links + hash, not router state?
 *   • Deep-linkable (e.g. /settings#wallet survives reloads & sharing)
 *   • Browser back/forward navigates between sub-sections naturally
 *   • Lets us reuse the shared `resolveNavLink` resolver — every section
 *     is modeled as a synthetic NavItem with `path: /settings/<id>`, so
 *     active-state matching is identical to the dock/header (no bespoke
 *     `activeSection === id` checks scattered through the page)
 *
 * The resolver is the single source of truth for "is this link active?"
 * across every nav surface in the app.
 */

export interface SettingsSection {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface SettingsSubNavProps {
  sections: readonly SettingsSection[];
  /** id used when no hash is present in the URL. */
  defaultId: string;
}

/**
 * Build the synthetic pathname the shared resolver should match against,
 * given the current URL hash. Pure helper — exported for tests.
 *
 * @example
 *   buildSyntheticPath("#wallet", "profile") // "/settings/wallet"
 *   buildSyntheticPath("",        "profile") // "/settings/profile"
 */
export const buildSyntheticPath = (hash: string, defaultId: string): string => {
  const id = hash.replace(/^#/, "").trim() || defaultId;
  return `/settings/${id}`;
};

/**
 * Resolves the currently active section id from the URL hash, falling
 * back to `defaultId` when the hash is missing or unrecognized. Used by
 * the page to decide which renderer to mount.
 */
export const useActiveSettingsSection = <T extends string>(
  sectionIds: readonly T[],
  defaultId: T,
): T => {
  const { hash } = useLocation();
  const fromHash = hash.replace(/^#/, "").trim() as T;
  return sectionIds.includes(fromHash) ? fromHash : defaultId;
};

/**
 * Tiny helper: lock body scroll position when the hash changes so the
 * browser doesn't auto-scroll to a (non-existent) anchor element. We
 * use the hash purely as a section selector, not as an in-page anchor.
 */
const useScrollPreservingHash = () => {
  const { hash } = useLocation();
  const [, force] = useState(0);
  useEffect(() => {
    // Re-render so consumers reading hash via useLocation pick up the
    // change immediately (router already does this; this is a guard for
    // edge cases where consumers cache the value).
    force((n) => n + 1);
  }, [hash]);
};

const SettingsSubNav = ({ sections, defaultId }: SettingsSubNavProps) => {
  const { pathname, hash } = useLocation();
  useScrollPreservingHash();

  // Synthesize the pathname the shared resolver will compare against —
  // e.g. /settings#wallet → /settings/wallet. Then every section gets the
  // same treatment as any top-level nav item: build a NavItem-shaped
  // descriptor and ask `resolveNavLink` whether it should be active.
  const syntheticPath = buildSyntheticPath(hash, defaultId);

  const renderLink = (
    section: SettingsSection,
    variant: "desktop" | "mobile",
  ) => {
    const Icon = section.icon;
    const target = `/settings/${section.id}`;
    const resolved = resolveNavLink({ path: target }, syntheticPath);
    const isActive = resolved.isActive;
    // The actual href stays on /settings (current page) and only changes
    // the hash, so we don't need a route per section.
    const href = `${pathname}#${section.id}`;

    if (variant === "desktop") {
      return (
        <Link
          key={section.id}
          to={href}
          replace
          aria-current={resolved.ariaCurrent}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-body font-medium transition-colors text-left w-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            isActive
              ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {section.label}
          {isActive && <ChevronRight className="h-3 w-3 ml-auto" />}
        </Link>
      );
    }

    return (
      <Link
        key={section.id}
        to={href}
        replace
        aria-current={resolved.ariaCurrent}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body font-medium transition-colors whitespace-nowrap shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon className="h-3 w-3" />
        {section.label}
      </Link>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <nav
        aria-label="Settings sections"
        className="hidden md:flex flex-col w-52 shrink-0 sticky top-20 self-start space-y-0.5"
      >
        {sections.map((s) => renderLink(s, "desktop"))}
      </nav>

      {/* Mobile horizontal scroll */}
      <nav
        aria-label="Settings sections"
        className="md:hidden fixed top-12 left-0 right-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-2 overflow-x-auto flex gap-1.5 no-scrollbar"
      >
        {sections.map((s) => renderLink(s, "mobile"))}
      </nav>
    </>
  );
};

export default SettingsSubNav;
