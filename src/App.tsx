import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SolanaWalletProvider } from "@/contexts/SolanaWalletContext";
import LaunchpadWalletBridge from "@/components/launchpad/LaunchpadWalletBridge";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthGateProvider } from "@/components/AuthGateDialog";
import AppLayout from "@/components/AppLayout";
import AuthPage from "@/pages/AuthPage";
import LandingPage from "@/pages/LandingPage";
// DashboardPage retired in v8 — /dashboard now redirects to /discover.
import ProjectsPage from "@/pages/ProjectsPage";
import ProjectDetailPage from "@/pages/ProjectDetailPage";
import CalendarPage from "@/pages/CalendarPage";
// FlowModePage is the public Verified-IP browser.
// SmartboardsPage retained as a file but no longer routed at /smartboards.
import CreatorsHubPage from "@/pages/CreatorsHubPage";
import ListingDetailPage from "@/pages/ListingDetailPage";
import SmartboardDetailPage from "@/pages/SmartboardDetailPage";
import SmartboardPresentationPage from "@/pages/SmartboardPresentationPage";
import ProfileDetailPage from "@/pages/ProfileDetailPage";
import MessagesPage from "@/pages/MessagesPage";
import SettingsPage from "@/pages/SettingsPage";
import ServicesPage from "@/pages/ServicesPage";
import CreditShopPage from "@/pages/CreditShopPage";
// DropRoomsPage retained as a file but no longer routed at /drop-rooms (redirects to /projects).
import { LegacyAliasRedirect } from "@/components/LegacyAliasRedirect";
import { NAV_ALIASES } from "@/config/navigation";
import DropRoomDetailPage from "@/pages/DropRoomDetailPage";
import AdminPage from "@/pages/AdminPage";
import StudiosPage from "@/pages/StudiosPage";
import StudioDetailPage from "@/pages/StudioDetailPage";
import StudioApplicationPage from "@/pages/StudioApplicationPage";
import StudioManagePage from "@/pages/StudioManagePage";
import ExploreStudiosPage from "@/pages/ExploreStudiosPage";
import ExploreCreatorsPage from "@/pages/ExploreCreatorsPage";
import OnboardingPage from "@/pages/OnboardingPage";
// MarketplacePage retained as a file but no longer routed — /marketplace redirects to /hub.
import HomePage from "@/pages/HomePage";
import DiscoverPage from "@/pages/DiscoverPage";
import InfrastructurePage from "@/pages/InfrastructurePage";
// WorksPage is no longer routed here — it's mounted inside SettingsPage
// (Provenance section). /works redirects to /settings#provenance below.
// /spaces is the Luma-inspired hub: Events timeline · Spaces marketplace · Discover.
// PeoplePage retained but unrouted — /people redirects to /discover.
// HubPage retired in v8 — /stream + /hub redirect to /discover.
import SpacesHubPage from "@/pages/SpacesHubPage";
import EventCreatePage from "@/pages/EventCreatePage";
import EventDetailPage from "@/pages/EventDetailPage";
import EventsExplorePage from "@/pages/EventsExplorePage";
import EventManagePage from "@/pages/EventManagePage";
import TicketDetailPage from "@/pages/TicketDetailPage";
import { ProfileRedirect } from "@/components/ProfileRedirect";
import FlowModePage from "@/pages/FlowModePage";
import LaunchRedirect from "@/pages/LaunchRedirect";
// /rewards now redirects to /credits?tab=how — explainer lives inside Creator Pass
import SwapHistoryPage from "@/pages/SwapHistoryPage";
import UnsubscribePage from "@/pages/UnsubscribePage";
import VerificationPage from "@/pages/VerificationPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/**
 * Registry of all top-level route path patterns (as passed to <Route path=...>).
 * Used by the dev-only nav-link sanity check in AppLayout to warn when a
 * configured header link has no matching route.
 *
 * Keep this list in sync with the <Route> elements below. Dynamic segments
 * use the standard `:param` syntax.
 */
export const REGISTERED_ROUTE_PATHS: string[] = [
  "/auth",
  "/onboarding",
  "/landing",
  "/infrastructure",
  "/works",
  "/explore/studios",
  "/explore/studios/:id",
  "/explore/creators",
  "/explore/creators/:id",
  "/",
  "/dashboard",
  "/discover",
  "/stream",
  "/hub",
  "/profile",
  "/spaces",
  "/events",
  "/spaces/events/:id",
  "/spaces/events/new",
  "/spaces/events/:id/manage",
  "/studios",
  "/studios/:id",
  "/studios/apply",
  "/studios/:id/manage",
  "/services",
  "/projects",
  "/projects/:id",
  "/calendar",
  "/bookings",
  "/credits",
  "/purchases",
  "/rewards",
  "/swaps",
  "/unsubscribe",
  "/smartboards",
  "/smartboards/:id",
  "/flow",
  "/creators",
  "/creators/:id",
  "/marketplace",
  "/marketplace/:id",
  "/seller",
  "/inquiries",
  "/profiles",
  "/profiles/:id",
  "/drop-rooms",
  "/drop-rooms/:id",
  // Legacy alias wildcards are appended dynamically from NAV_ALIASES below.
  "/messages",
  "/network",
  "/settings",
  "/admin",
  "/boards/:id",
  "/tickets/:id",
  // Auto-register every legacy alias as `<from>/*` so the dev-only nav
  // sanity check sees them and the array stays the source of truth.
  ...NAV_ALIASES.map(({ from }) => `${from}/*`),
];

/** Routes that strictly require authentication */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/discover" replace />;
  return <>{children}</>;
};

const AuthGateWrapper = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  return (
    <AuthGateProvider isAuthenticated={!!user}>
      {children}
    </AuthGateProvider>
  );
};

/**
 * Root entry — `/`
 * v6: Discover is the front door for everyone. Guests see it (with the
 * landing-style hero copy), authed users see it personalized.
 */
const RootEntry = () => {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  return <Navigate to="/discover" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <SolanaWalletProvider>
    <LaunchpadWalletBridge />
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AuthGateWrapper>
            <Routes>
              {/* Auth page — redirect to dashboard if already logged in */}
              <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
              <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />

              {/* Legacy landing — redirect to dashboard */}
              <Route path="/landing" element={<LandingPage />} />

              {/* Public infrastructure thesis page (S33R-aligned framing) */}
              <Route path="/infrastructure" element={<InfrastructurePage />} />

              {/* Email unsubscribe — fully public, accessible from email links */}
              <Route path="/unsubscribe" element={<UnsubscribePage />} />

              {/* Explore pages — fully public */}
              <Route path="/explore/studios" element={<ExploreStudiosPage />} />
              <Route path="/explore/studios/:id" element={<ExploreStudiosPage />} />
              <Route path="/explore/creators" element={<ExploreCreatorsPage />} />
              <Route path="/explore/creators/:id" element={<ExploreCreatorsPage />} />

              {/* Public root — guests see HomePage, authed users redirect to /dashboard */}
              <Route path="/" element={<RootEntry />} />

              {/* Main app — browsable by everyone, auth-gated actions inside */}
              <Route element={<AppLayout />}>
                {/* v8: My Studio retired. /dashboard → Discover. */}
                <Route path="/dashboard" element={<Navigate to="/discover" replace />} />
                <Route path="/discover" element={<DiscoverPage />} />
                {/* v8: Hub/Stream retired — Discover is the unified front
                    door. Mosaic + composer + flow toggle all live there.
                    Legacy roots redirect; sub-routes stay live. */}
                <Route path="/stream" element={<Navigate to="/discover" replace />} />
                <Route path="/hub" element={<Navigate to="/discover" replace />} />
                <Route path="/spaces" element={<Navigate to="/discover?kind=space" replace />} />
                <Route path="/events" element={<EventsExplorePage />} />
                <Route path="/spaces/events/new" element={<ProtectedRoute><EventCreatePage /></ProtectedRoute>} />
                <Route path="/spaces/events/:id" element={<EventDetailPage />} />
                <Route path="/spaces/events/:id/manage" element={<ProtectedRoute><EventManagePage /></ProtectedRoute>} />
                <Route path="/tickets/:id" element={<ProtectedRoute><TicketDetailPage /></ProtectedRoute>} />
                <Route path="/people" element={<Navigate to="/discover" replace />} />
                <Route path="/profile" element={<ProfileRedirect />} />
                <Route path="/studios" element={<Navigate to="/discover?kind=space" replace />} />
                <Route path="/studios/:id" element={<StudioDetailPage />} />
                <Route path="/studios/apply" element={<StudioApplicationPage />} />
                <Route path="/studios/:id/manage" element={<StudioManagePage />} />
                <Route path="/services" element={<ServicesPage />} />
                {/* v7: Projects collapses into Inbox (next pass adds
                    inline-expansion). Bare /projects redirects; the
                    detail page stays live so existing thread links and
                    deep-links from Tools tabs still resolve. */}
                <Route path="/projects" element={<Navigate to="/messages?tab=projects" replace />} />
                <Route path="/projects/:id" element={<ProjectDetailPage />} />
                {/* Works is now the personal vault under Settings → Provenance.
                    /works keeps working as a deep link via redirect. */}
                <Route path="/works" element={<Navigate to="/settings#provenance" replace />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/bookings" element={<CalendarPage />} />
                <Route path="/credits" element={<CreditShopPage />} />
                <Route path="/purchases" element={<Navigate to="/credits?tab=purchases" replace />} />
                {/* v8: rewards explainer folded back into Creator Pass
                    as a tab so back-nav lands you on Creator Pass instead
                    of Discover. /rewards stays as a deep-link redirect. */}
                <Route path="/rewards" element={<Navigate to="/credits?tab=how" replace />} />
                <Route path="/swaps" element={<SwapHistoryPage />} />
                {/* Flow Mode — first-class public browser for fingerprinted
                    creative IP. Smartboards / Drop Rooms index routes still
                    redirect into Projects; their detail routes stay live so
                    the Tools panel can deep-link individual items. */}
                <Route path="/flow" element={<FlowModePage />} />
                {/* Launchpad page is gone — coins are now profile-bound.
                    /launchpad redirects to the Hub; /launchpad/:id resolves
                    the coin's creator and forwards to their profile Coin tab. */}
                <Route path="/launchpad" element={<Navigate to="/discover" replace />} />
                <Route path="/launchpad/:id" element={<LaunchRedirect />} />
                <Route path="/smartboards" element={<Navigate to="/projects" replace />} />
                <Route path="/smartboards/:id" element={<SmartboardDetailPage />} />
                <Route path="/drop-rooms" element={<Navigate to="/projects" replace />} />
                <Route path="/drop-rooms/:id" element={<DropRoomDetailPage />} />
                {/* Legacy Creators Hub → Discover */}
                <Route path="/creators" element={<Navigate to="/discover" replace />} />
                <Route path="/creators/:id" element={<ListingDetailPage />} />
                {/* Legacy Marketplace → Discover (detail pages still resolve) */}
                <Route path="/marketplace" element={<Navigate to="/discover?kind=offering" replace />} />
                <Route path="/marketplace/:id" element={<ListingDetailPage />} />
                <Route path="/seller" element={<Navigate to="/settings" replace />} />
                <Route path="/inquiries" element={<Navigate to="/messages" replace />} />
                <Route path="/profiles" element={<Navigate to="/discover" replace />} />
                <Route path="/profiles/:id" element={<ProfileDetailPage />} />
                {/* Centralized legacy aliases — generated from NAV_ALIASES.
                    Add a new redirect by adding a `matchPaths` entry to a
                    NavItem in src/config/navigation.ts (no route edit needed
                    here unless you want a brand-new prefix). */}
                {NAV_ALIASES.map(({ from }) => (
                  <Route
                    key={from}
                    path={`${from}/*`}
                    element={<LegacyAliasRedirect />}
                  />
                ))}
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/network" element={<Navigate to="/messages" replace />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/settings/verification" element={<VerificationPage />} />
                <Route path="/admin" element={<AdminPage />} />
              </Route>
              <Route path="/boards/:id" element={<SmartboardPresentationPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthGateWrapper>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </SolanaWalletProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
