import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { LegacyAliasRedirect } from "@/components/LegacyAliasRedirect";
import LegacyEventRedirect from "@/components/LegacyEventRedirect";
import ProtectedRoute from "@/components/ProtectedRoute";
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

// Route configuration intentionally exports JSX data for App.tsx to render.
// eslint-disable-next-line react-refresh/only-export-components
export const APP_ROUTES: AppRoute[] = [
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

export const APP_ROUTE_PATHS = APP_ROUTES.map(({ path }) => path);
