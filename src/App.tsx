import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SolanaWalletProvider } from "@/contexts/SolanaWalletContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AppLayout from "@/components/AppLayout";
import AuthPage from "@/pages/AuthPage";
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
import DropRoomDetailPage from "@/pages/DropRoomDetailPage";
import AdminPage from "@/pages/AdminPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <SolanaWalletProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/bookings" element={<CalendarPage />} />
              <Route path="/credits" element={<CreditShopPage />} />
              <Route path="/purchases" element={<Navigate to="/credits?tab=purchases" replace />} />
              <Route path="/flow" element={<FlowModePage />} />
              <Route path="/smartboards" element={<SmartboardsPage />} />
              <Route path="/smartboards/:id" element={<SmartboardDetailPage />} />
              <Route path="/creators" element={<CreatorsHubPage />} />
              <Route path="/creators/:id" element={<ListingDetailPage />} />
              {/* Legacy redirects */}
              <Route path="/marketplace" element={<Navigate to="/creators" replace />} />
              <Route path="/marketplace/:id" element={<Navigate to="/creators" replace />} />
              <Route path="/seller" element={<Navigate to="/settings" replace />} />
              <Route path="/inquiries" element={<Navigate to="/messages?tab=inquiries" replace />} />
              <Route path="/profiles" element={<Navigate to="/creators?tab=creators" replace />} />
              <Route path="/profiles/:id" element={<ProfileDetailPage />} />
              <Route path="/drop-rooms" element={<DropRoomsPage />} />
              <Route path="/drop-rooms/:id" element={<DropRoomDetailPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Route>
            <Route path="/boards/:id" element={<SmartboardPresentationPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </SolanaWalletProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
