import type { ReactElement, ReactNode } from "react";
import { Navigate, Route, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { EventNotFound } from "@/components/events/EventNotFound";
import { LegacyAliasRedirect } from "@/components/LegacyAliasRedirect";
import FlowAuthGuard from "@/components/FlowAuthGuard";
import { NAV_ALIASES } from "@/config/navigation";
import HomeFeedPage from "@/pages/HomeFeedPage";
import SceneRoomPage from "@/pages/SceneRoomPage";
import VaultRoomPage from "@/pages/VaultRoomPage";
import TreasuryPage from "@/pages/TreasuryPage";
import EventCreatePage from "@/pages/EventCreatePage";
import EventDetailPage from "@/pages/EventDetailPage";
import EventManagePage from "@/pages/EventManagePage";
import TicketCheckoutReturnPage from "@/pages/TicketCheckoutReturnPage";
import TicketDetailPage from "@/pages/TicketDetailPage";
import { ProfileRedirect } from "@/components/ProfileRedirect";
import StudioDetailPage from "@/pages/StudioDetailPage";
import ExploreStudiosPage from "@/pages/ExploreStudiosPage";
import StudioApplicationPage from "@/pages/StudioApplicationPage";
import StudioManagePage from "@/pages/StudioManagePage";
import ServicesPage from "@/pages/ServicesPage";
import StudioPage from "@/pages/StudioPage";
import ProjectsPage from "@/pages/ProjectsPage";
import ProjectDetailPage from "@/pages/ProjectDetailPage";
import ProjectCanvasPage from "@/pages/ProjectCanvasPage";
import ReleasePage from "@/pages/ReleasePage";
import ArSplitterGuidePage from "@/pages/ArSplitterGuidePage";
import CalendarPage from "@/pages/CalendarPage";
import CreditShopPage from "@/pages/CreditShopPage";
import SwapHistoryPage from "@/pages/SwapHistoryPage";
import FlowModePage from "@/pages/FlowModePage";
import SmartboardDetailPage from "@/pages/SmartboardDetailPage";
import DropRoomDetailPage from "@/pages/DropRoomDetailPage";
import ListingDetailPage from "@/pages/ListingDetailPage";
import MarketplacePage from "@/pages/MarketplacePage";
import ProfileDetailPage from "@/pages/ProfileDetailPage";
import MessagesPage from "@/pages/MessagesPage";
import MyWorkPage from "@/pages/MyWorkPage";
import SettingsPage from "@/pages/SettingsPage";
import PortfolioPage from "@/pages/PortfolioPage";
import AdminPage from "@/pages/AdminPage";
import CuratorPage from "@/pages/CuratorPage";
import ConciergePage from "@/pages/ConciergePage";
import WhyLaunchCoinPage from "@/pages/WhyLaunchCoinPage";
import SubscriptionsPage from "@/pages/SubscriptionsPage";
import VerificationPage from "@/pages/VerificationPage";

export interface AppRoute {
  path: string;
  element: ReactNode;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LegacyEventRedirect = ({ manage = false }: { manage?: boolean }) => {
  const { id } = useParams();
  if (!id || !UUID_RE.test(id)) {
    return (
      <EventNotFound
        title="Invalid event link"
        message="That URL doesn't point to a real event ID."
        badId={id}
      />
    );
  }
  return <Navigate to={`/spaces/events/${id}${manage ? "/manage" : ""}`} replace />;
};

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const APP_ROUTES: AppRoute[] = [
  { path: "/dashboard", element: <Navigate to="/home" replace /> },
  { path: "/home", element: <HomeFeedPage /> },
  { path: "/scene", element: <SceneRoomPage /> },
  { path: "/market", element: <Navigate to="/discover" replace /> },
  { path: "/connect/match", element: <Navigate to="/discover" replace /> },
  { path: "/vault", element: <ProtectedRoute><VaultRoomPage /></ProtectedRoute> },
  { path: "/discover", element: <Navigate to="/home" replace /> },
  { path: "/charts", element: <Navigate to="/home" replace /> },
  { path: "/treasury", element: <TreasuryPage /> },
  { path: "/stream", element: <Navigate to="/discover" replace /> },
  { path: "/hub", element: <Navigate to="/discover" replace /> },
  { path: "/spaces", element: <Navigate to="/discover" replace /> },
  { path: "/events", element: <Navigate to="/discover" replace /> },
  { path: "/events/new", element: <Navigate to="/spaces/events/new" replace /> },
  { path: "/events/:id", element: <LegacyEventRedirect /> },
  { path: "/events/:id/manage", element: <LegacyEventRedirect manage /> },
  { path: "/spaces/events/new", element: <ProtectedRoute><EventCreatePage /></ProtectedRoute> },
  { path: "/spaces/events/:id", element: <EventDetailPage /> },
  { path: "/spaces/events/:id/manage", element: <ProtectedRoute><EventManagePage /></ProtectedRoute> },
  { path: "/tickets/return", element: <TicketCheckoutReturnPage /> },
  { path: "/tickets/:id", element: <ProtectedRoute><TicketDetailPage /></ProtectedRoute> },
  { path: "/people", element: <Navigate to="/discover" replace /> },
  { path: "/profile", element: <ProfileRedirect /> },
  { path: "/studios", element: <Navigate to="/discover?kind=space" replace /> },
  { path: "/studios/:id", element: <StudioDetailPage /> },
  { path: "/studios/apply", element: <StudioApplicationPage /> },
  { path: "/studios/:id/manage", element: <StudioManagePage /> },
  { path: "/services", element: <ServicesPage /> },
  { path: "/projects", element: <Navigate to="/messages?tab=projects" replace /> },
  { path: "/my-projects", element: <StudioPage /> },
  { path: "/studio", element: <StudioPage /> },
  { path: "/projects-legacy", element: <ProjectsPage /> },
  { path: "/projects/:id", element: <ProjectDetailPage /> },
  { path: "/projects/:id/canvas", element: <ProjectCanvasPage /> },
  { path: "/release/:slug", element: <ReleasePage /> },
  { path: "/ar-splitter", element: <ArSplitterGuidePage /> },
  { path: "/squads-splitter", element: <Navigate to="/ar-splitter" replace /> },
  { path: "/works", element: <Navigate to="/settings#provenance" replace /> },
  { path: "/calendar", element: <CalendarPage /> },
  { path: "/bookings", element: <CalendarPage /> },
  { path: "/credits", element: <CreditShopPage /> },
  { path: "/purchases", element: <Navigate to="/credits?tab=activity" replace /> },
  { path: "/rewards", element: <Navigate to="/credits?tab=how" replace /> },
  { path: "/swaps", element: <SwapHistoryPage /> },
  { path: "/flow", element: <FlowAuthGuard><FlowModePage /></FlowAuthGuard> },
  { path: "/launchpad", element: <Navigate to="/discover" replace /> },
  { path: "/launchpad/:id", element: <Navigate to="/discover" replace /> },
  { path: "/coin/:slug", element: <Navigate to="/discover" replace /> },
  { path: "/smartboards", element: <Navigate to="/projects" replace /> },
  { path: "/smartboards/:id", element: <SmartboardDetailPage /> },
  { path: "/drop-rooms", element: <Navigate to="/projects" replace /> },
  { path: "/drop-rooms/:id", element: <DropRoomDetailPage /> },
  { path: "/creators", element: <Navigate to="/discover" replace /> },
  { path: "/creators/:id", element: <ListingDetailPage /> },
  { path: "/marketplace", element: <MarketplacePage /> },
  { path: "/marketplace/:id", element: <ListingDetailPage /> },
  { path: "/listings/:id", element: <ListingDetailPage /> },
  { path: "/seller", element: <Navigate to="/settings" replace /> },
  { path: "/inquiries", element: <Navigate to="/messages" replace /> },
  { path: "/profiles", element: <Navigate to="/discover" replace /> },
  { path: "/profiles/:id", element: <ProfileDetailPage /> },
  ...NAV_ALIASES.map(({ from }) => ({
    path: `${from}/*`,
    element: <LegacyAliasRedirect />,
  })),
  { path: "/messages", element: <MessagesPage /> },
  { path: "/my-work", element: <MyWorkPage /> },
  { path: "/network", element: <Navigate to="/messages" replace /> },
  { path: "/subscriptions", element: <SubscriptionsPage /> },
  { path: "/settings", element: <SettingsPage /> },
  { path: "/portfolio", element: <PortfolioPage /> },
  { path: "/fan/rewards", element: <Navigate to="/credits" replace /> },
  { path: "/settings/verification", element: <VerificationPage /> },
  { path: "/admin", element: <AdminPage /> },
  { path: "/curator", element: <CuratorPage /> },
  { path: "/concierge", element: <Navigate to="/label-services" replace /> },
  { path: "/label-services", element: <ConciergePage /> },
  { path: "/why-coin", element: <WhyLaunchCoinPage /> },
  { path: "/launch-coin", element: <Navigate to="/why-coin" replace /> },
];

type AppRoutesComponent = (() => ReactElement) & { routePaths: string[] };

const AppRoutes = (() => (
  <>
    {APP_ROUTES.map(({ path, element }) => (
      <Route key={path} path={path} element={element} />
    ))}
  </>
)) as AppRoutesComponent;

AppRoutes.routePaths = APP_ROUTES.map(({ path }) => path);

export default AppRoutes;
