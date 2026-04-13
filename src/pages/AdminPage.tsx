import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users, Award, Building2, Coins } from "lucide-react";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminBadges from "@/components/admin/AdminBadges";
import AdminStudioApplications from "@/components/admin/AdminStudioApplications";
import AdminPendingRewards from "@/components/admin/AdminPendingRewards";

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
        <p className="text-muted-foreground">Platform administration — review applications, manage users & badges</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/50 flex-wrap">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="rewards" className="gap-2">
            <Coins className="h-4 w-4" /> Rewards
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="badges" className="gap-2">
            <Award className="h-4 w-4" /> Badges
          </TabsTrigger>
          <TabsTrigger value="studios" className="gap-2">
            <Building2 className="h-4 w-4" /> Studio Applications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AdminOverview />
        </TabsContent>
        <TabsContent value="rewards">
          <AdminPendingRewards />
        </TabsContent>
        <TabsContent value="users">
          <AdminUsers />
        </TabsContent>
        <TabsContent value="badges">
          <AdminBadges />
        </TabsContent>
        <TabsContent value="studios">
          <AdminStudioApplications />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPage;
