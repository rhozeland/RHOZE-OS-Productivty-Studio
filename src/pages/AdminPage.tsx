import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users, Award, Building2, Coins, AlertTriangle, Wallet, Eye } from "lucide-react";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminBadges from "@/components/admin/AdminBadges";
import AdminStudioApplications from "@/components/admin/AdminStudioApplications";
import AdminPendingRewards from "@/components/admin/AdminPendingRewards";
import AdminDisputes from "@/components/admin/AdminDisputes";
import AdminWithdrawals from "@/components/admin/AdminWithdrawals";
import AdminContentModeration from "@/components/admin/AdminContentModeration";

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
        <p className="text-sm text-muted-foreground">Platform administration</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/50 w-full justify-start overflow-x-auto overflow-y-hidden scrollbar-none">
          <TabsTrigger value="overview" className="gap-1.5 text-xs shrink-0">
            <BarChart3 className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="rewards" className="gap-1.5 text-xs shrink-0">
            <Coins className="h-3.5 w-3.5" /> Rewards
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5 text-xs shrink-0">
            <Users className="h-3.5 w-3.5" /> Users
          </TabsTrigger>
          <TabsTrigger value="badges" className="gap-1.5 text-xs shrink-0">
            <Award className="h-3.5 w-3.5" /> Badges
          </TabsTrigger>
          <TabsTrigger value="studios" className="gap-1.5 text-xs shrink-0">
            <Building2 className="h-3.5 w-3.5" /> Studios
          </TabsTrigger>
          <TabsTrigger value="disputes" className="gap-1.5 text-xs shrink-0">
            <AlertTriangle className="h-3.5 w-3.5" /> Disputes
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="gap-1.5 text-xs shrink-0">
            <Wallet className="h-3.5 w-3.5" /> Withdrawals
          </TabsTrigger>
          <TabsTrigger value="moderation" className="gap-1.5 text-xs shrink-0">
            <Eye className="h-3.5 w-3.5" /> Content
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><AdminOverview /></TabsContent>
        <TabsContent value="rewards"><AdminPendingRewards /></TabsContent>
        <TabsContent value="users"><AdminUsers /></TabsContent>
        <TabsContent value="badges"><AdminBadges /></TabsContent>
        <TabsContent value="studios"><AdminStudioApplications /></TabsContent>
        <TabsContent value="disputes"><AdminDisputes /></TabsContent>
        <TabsContent value="withdrawals"><AdminWithdrawals /></TabsContent>
        <TabsContent value="moderation"><AdminContentModeration /></TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPage;
