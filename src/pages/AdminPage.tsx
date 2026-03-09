import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Briefcase, Users, Settings } from "lucide-react";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminServices from "@/components/admin/AdminServices";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminSettings from "@/components/admin/AdminSettings";

const AdminPage = () => {
  const { isAdmin, loading } = useAdminCheck();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
        <p className="text-muted-foreground">Manage services, users, and studio settings</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-2">
            <Briefcase className="h-4 w-4" /> Services
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" /> Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AdminOverview />
        </TabsContent>
        <TabsContent value="services">
          <AdminServices />
        </TabsContent>
        <TabsContent value="users">
          <AdminUsers />
        </TabsContent>
        <TabsContent value="settings">
          <AdminSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPage;
