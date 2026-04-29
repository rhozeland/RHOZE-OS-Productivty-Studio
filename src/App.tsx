import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SolanaWalletProvider } from "@/contexts/SolanaWalletContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthGateProvider } from "@/components/AuthGateDialog";
import AppLayout from "@/components/AppLayout";
import AuthPage from "@/pages/AuthPage";
import LandingPage from "@/pages/LandingPage";
import DashboardPage from "@/pages/DashboardPage";
import ProjectsPage from "@/pages/ProjectsPage";
import ProjectDetailPage from "@/pages/ProjectDetailPage";
import CalendarPage from "@/pages/CalendarPage";
import FlowModePage from "@/pages/FlowModePage";
import SmartboardsPage from "@/pages/SmartboardsPage";
import CreatorsHubPage from "@/pages/CreatorsHubPage";
import ListingDetailPage from "@/pages/ListingDetailPage";
import SmartboardDetailPage from "@/pages/SmartboardDetailPage";
import SmartboardPresentationPage from "@/pages/SmartboardPresentationPage";
import ProfileDetailPage from "@/pages/ProfileDetailPage";
import MessagesPage from "@/pages/MessagesPage";
import SettingsPage from "@/pages/SettingsPage";
import ServicesPage from "@/pages/ServicesPage";
import CreditShopPage from "@/pages/CreditShopPage";
import DropRoomsPage from "@/pages/DropRoomsPage";
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
import MarketplacePage from "@/pages/MarketplacePage";
import HomePage from "@/pages/HomePage";
import SpacesPage from "@/pages/SpacesPage";
import PeoplePage from "@/pages/PeoplePage";
import { FlowAuthGuard } from "@/components/FlowAuthGuard";
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
  "/explore/studios",
  "/explore/studios/:id",
  "/explore/creators",
  "/explore/creators/:id",
  "/",
  "/dashboard",
  "/spaces",
  "/people",
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
  "/flow",
  "/smartboards",
  "/smartboards/:id",
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
  if (user) return <Navigate to="/dashboard" replace />;
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
 * Guests see the public HomePage (clean, no sidebar/dock).
 * Authed users redirect to /dashboard inside AppLayout.
 */
const RootEntry = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" replace />;
  return <HomePage />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <SolanaWalletProvider>
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

              {/* Explore pages — fully public */}
              <Route path="/explore/studios" element={<ExploreStudiosPage />} />
              <Route path="/explore/studios/:id" element={<ExploreStudiosPage />} />
              <Route path="/explore/creators" element={<ExploreCreatorsPage />} />
              <Route path="/explore/creators/:id" element={<ExploreCreatorsPage />} />

              {/* Public root — guests see HomePage, authed users redirect to /dashboard */}
              <Route path="/" element={<RootEntry />} />

              {/* Main app — browsable by everyone, auth-gated actions inside */}
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                {/* New primary pillars — Spaces (physical+digital) & People */}
                <Route path="/spaces" element={<SpacesPage />} />
                <Route path="/people" element={<PeoplePage />} />
                <Route path="/studios" element={<StudiosPage />} />
                <Route path="/studios/:id" element={<StudioDetailPage />} />
                <Route path="/studios/apply" element={<StudioApplicationPage />} />
                <Route path="/studios/:id/manage" element={<StudioManagePage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/projects/:id" element={<ProjectDetailPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/bookings" element={<CalendarPage />} />
                <Route path="/credits" element={<CreditShopPage />} />
                <Route path="/purchases" element={<Navigate to="/credits?tab=purchases" replace />} />
                <Route path="/flow" element={<FlowAuthGuard><FlowModePage /></FlowAuthGuard>} />
                <Route path="/smartboards" element={<SmartboardsPage />} />
                <Route path="/smartboards/:id" element={<SmartboardDetailPage />} />
                <Route path="/creators" element={<CreatorsHubPage />} />
                <Route path="/creators/:id" element={<ListingDetailPage />} />
                <Route path="/marketplace" element={<MarketplacePage />} />
                <Route path="/marketplace/:id" element={<ListingDetailPage />} />
                <Route path="/seller" element={<Navigate to="/settings" replace />} />
                <Route path="/inquiries" element={<Navigate to="/messages?tab=inquiries" replace />} />
                <Route path="/profiles" element={<Navigate to="/creators?tab=creators" replace />} />
                <Route path="/profiles/:id" element={<ProfileDetailPage />} />
                <Route path="/drop-rooms" element={<DropRoomsPage />} />
                <Route path="/drop-rooms/:id" element={<DropRoomDetailPage />} />
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
