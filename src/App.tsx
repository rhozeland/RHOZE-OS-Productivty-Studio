import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SolanaWalletProvider } from "@/contexts/SolanaWalletContext";
// v10.2 — simulated launchpad wallet bridge removed; tokens are now read-only discovery
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthGateProvider } from "@/components/AuthGateDialog";
import AppLayout from "@/components/AppLayout";
import { ProtectedRoute } from "@/config/app-routes";
import AuthPage from "@/pages/AuthPage";
import AccessGatePage from "@/pages/AccessGatePage";

// FlowModePage is the public Verified-IP browser.

import SmartboardPresentationPage from "@/pages/SmartboardPresentationPage";
// DropRoomsPage retained as a file but no longer routed at /drop-rooms (redirects to /projects).
import ExploreStudiosPage from "@/pages/ExploreStudiosPage";
import ExploreCreatorsPage from "@/pages/ExploreCreatorsPage";
import StudioDetailPage from "@/pages/StudioDetailPage";
import RoleSelectPage from "@/pages/RoleSelectPage";
import FanOnboardingPage from "@/pages/FanOnboardingPage";
import MusicianOnboardingPage from "@/pages/MusicianOnboardingPage";
// ChartsPage retired — /charts redirects to /home.
import CardPage from "@/pages/CardPage";

import InfrastructurePage from "@/pages/InfrastructurePage";

// WorksPage is no longer routed here — it's mounted inside SettingsPage
// (Provenance section). /works redirects to /settings#provenance below.
// /spaces and /events browse pages retired (v9.8) — both redirect into the
// Connect room (/market) so Spaces and Events live as tabs there. Detail and
// create routes (/spaces/events/:id, /spaces/events/new) stay live.
// PeoplePage retained but unrouted — /people redirects to /discover.
// HubPage retired in v8 — /stream + /hub redirect to /discover.
// EventsExplorePage retired (v8.5) — events now live inside Conversations → Events tab
// v10.2 — LaunchRedirect / LaunchDetailPage removed from the router; deep links redirect to Discover.
// /rewards now redirects to /credits?tab=how — explainer lives inside Creator Pass
import UnsubscribePage from "@/pages/UnsubscribePage";
// v11 — ConnectMatchPage retired; /connect/match now redirects to /market.
import NotFound from "./pages/NotFound";
import CheckoutReturn from "@/pages/CheckoutReturn";
import SubscriptionsPage from "@/pages/SubscriptionsPage";
import ReleasePage from "@/pages/ReleasePage";
import WhyLaunchCoinPage from "@/pages/WhyLaunchCoinPage";
import ArSplitterGuidePage from "@/pages/ArSplitterGuidePage";
import AppRoutes from "@/config/app-routes";

const queryClient = new QueryClient();

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/home" replace />;
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
 * Private-build gate — DISABLED. The app now opens straight to Home for
 * everyone; the AccessGate page stays mounted at /gate for easy revert.
 */
const PrivateBuildGate = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

/**
 * Root entry — `/`
 * Everyone (authed + guests) lands on Home. Landing page retired.
 */
const RootEntry = () => {
  return <Navigate to="/home" replace />;
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
            <PrivateBuildGate>
            <Routes>
              {/* Private-build access gate — code entry + waitlist. */}
              <Route path="/gate" element={<AccessGatePage />} />

              {/* Auth page — redirect to dashboard if already logged in */}
              <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
              <Route path="/onboarding" element={<Navigate to="/welcome" replace />} />
              <Route path="/onboarding/fan" element={<ProtectedRoute><FanOnboardingPage /></ProtectedRoute>} />
              <Route path="/onboarding/musician" element={<ProtectedRoute><MusicianOnboardingPage /></ProtectedRoute>} />
              <Route path="/welcome" element={<ProtectedRoute><RoleSelectPage /></ProtectedRoute>} />

              {/* Legacy landing — kept mounted but no longer the front door. */}
              <Route path="/landing" element={<Navigate to="/" replace />} />

              {/* Public infrastructure thesis page (S33R-aligned framing) */}
              <Route path="/infrastructure" element={<InfrastructurePage />} />

              {/* Email unsubscribe — fully public, accessible from email links */}
              <Route path="/unsubscribe" element={<UnsubscribePage />} />

              {/* Stripe Embedded Checkout return URL — public so Stripe can redirect here */}
              <Route path="/checkout/return" element={<CheckoutReturn />} />

              {/* Explore pages — fully public */}
              <Route path="/explore/studios" element={<ExploreStudiosPage />} />
              <Route path="/explore/studios/:id" element={<StudioDetailPage />} />
              <Route path="/explore/creators" element={<ExploreCreatorsPage />} />
              <Route path="/explore/creators/:id" element={<ExploreCreatorsPage />} />

              {/* Public share-card page — surfaces creator's Backed by Rhozeland card */}
              <Route path="/card/:creatorId" element={<CardPage />} />


              {/* Public root — guests see HomePage, authed users redirect to /dashboard */}
              <Route path="/" element={<RootEntry />} />

              {/* Main app — browsable by everyone, auth-gated actions inside */}
              <Route element={<AppLayout />}>
                <AppRoutes />
              </Route>
              <Route path="/boards/:id" element={<SmartboardPresentationPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </PrivateBuildGate>
          </AuthGateWrapper>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </SolanaWalletProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
