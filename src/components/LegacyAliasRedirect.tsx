import { useEffect, useRef } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Home } from "lucide-react";
import { matchAlias } from "@/config/navigation";
import { trackLegacyRedirect } from "@/lib/legacy-redirect-analytics";
import { Button } from "@/components/ui/button";

/**
 * Generic legacy-path redirect. Reads the current pathname, asks the
 * navigation config to resolve it to a canonical path, and issues a
 * `<Navigate replace />`. Search params and hash are preserved so deep
 * links survive the rewrite.
 *
 * Driven entirely by `NAV_ALIASES` in src/config/navigation.ts — to add a
 * new redirect, append a `matchPaths` entry to the relevant NavItem (or
 * an entry to EXTRA_ALIASES) and register a route in App.tsx via
 * `navAliasRoutes()`.
 *
 * Side effect: every successful redirect is logged via
 * `trackLegacyRedirect` so we can measure inbound traffic to legacy URLs
 * (e.g. how often `/droprooms/*` is still being hit).
 *
 * When `matchAlias` returns `null` (the path is registered as a legacy
 * route but no alias entry resolves it — usually because the alias was
 * just removed) we render the dedicated `LegacyAliasFallback` page below
 * instead of silently bouncing the user to "/". That gives them context
 * about why their bookmark broke and obvious next steps.
 */
export const LegacyAliasRedirect = () => {
  const { pathname, search, hash } = useLocation();
  const match = matchAlias(pathname);
  // Guard against firing the analytics event twice for the same redirect
  // when React strict-mode double-invokes effects in development.
  const loggedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!match) return;
    const key = `${pathname}->${match.to}`;
    if (loggedRef.current === key) return;
    loggedRef.current = key;
    trackLegacyRedirect({
      from: pathname,
      to: match.to,
      prefix: match.alias.from,
    });
  }, [pathname, match]);

  if (!match) return <LegacyAliasFallback pathname={pathname} />;
  return <Navigate to={`${match.to}${search}${hash}`} replace />;
};

/**
 * Fallback page rendered when a path looks legacy (it's registered for the
 * `LegacyAliasRedirect` route) but the alias config has no entry to
 * resolve it. Tells the user *why* the URL didn't take them anywhere and
 * gives them clear escapes (Home, Back) so we never silently dump them on
 * the landing page.
 *
 * Exported for testability — App.tsx uses `LegacyAliasRedirect`, but tests
 * and Storybook can mount the fallback directly.
 */
export const LegacyAliasFallback = ({ pathname }: { pathname: string }) => {
  // Log unresolved legacy hits with `to: null` so we can see which legacy
  // paths still get traffic without a destination — that's the signal to
  // either add a new alias or quietly retire the route.
  const loggedRef = useRef<string | null>(null);
  useEffect(() => {
    if (loggedRef.current === pathname) return;
    loggedRef.current = pathname;
    trackLegacyRedirect({
      from: pathname,
      to: null,
      prefix: null,
    });
  }, [pathname]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-5">
        <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-display font-semibold text-foreground">
            That link is no longer available
          </h1>
          <p className="text-sm text-muted-foreground">
            The URL you followed used to point somewhere on Rhozeland but the
            destination has since been retired or renamed. We didn&apos;t want
            to silently send you to the home page without telling you.
          </p>
          <p className="text-xs text-muted-foreground/70 pt-1">
            Old path:{" "}
            <code className="font-mono text-foreground/80 break-all">
              {pathname}
            </code>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
          <Button asChild className="gap-1.5">
            <Link to="/">
              <Home className="h-4 w-4" />
              Take me home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
