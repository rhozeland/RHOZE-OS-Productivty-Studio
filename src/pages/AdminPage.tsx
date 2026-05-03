import { useAdminCheck } from "@/hooks/useAdminCheck";
import { Navigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Users, Award, Building2, Coins, AlertTriangle, Wallet, Eye, Sliders, ShieldCheck, Percent } from "lucide-react";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminBadges from "@/components/admin/AdminBadges";
import AdminStudioApplications from "@/components/admin/AdminStudioApplications";
import AdminPendingRewards from "@/components/admin/AdminPendingRewards";
import AdminDisputes from "@/components/admin/AdminDisputes";
import AdminWithdrawals from "@/components/admin/AdminWithdrawals";
import AdminContentModeration from "@/components/admin/AdminContentModeration";
import AdminUnderwritingRules from "@/components/admin/AdminUnderwritingRules";
import AdminUnderwritingRulesAudit from "@/components/admin/AdminUnderwritingRulesAudit";
import AdminWorkVerifications from "@/components/admin/AdminWorkVerifications";
import AdminArtistVerifications from "@/components/admin/AdminArtistVerifications";
import AdminRewardCaps from "@/components/admin/AdminRewardCaps";
import AdminPlatformFees from "@/components/admin/AdminPlatformFees";

const VALID_TABS = new Set([
  "overview", "rewards", "caps", "users", "badges", "studios", "ip",
  "artists", "disputes", "withdrawals", "moderation", "capital", "fees",
]);

const AdminPage = () => {
  const { isAdmin, loading } = useAdminCheck();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  // Accept ?tab=verifications as an alias for the artists queue (used by
  // admin verification-request notifications).
  const initialTab =
    tabParam === "verifications"
      ? "artists"
      : tabParam && VALID_TABS.has(tabParam)
        ? tabParam
        : "overview";

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

      <Tabs
        value={initialTab}
        onValueChange={(v) => {
          const next = new URLSearchParams(searchParams);
          if (v === "overview") next.delete("tab");
          else next.set("tab", v);
          setSearchParams(next, { replace: true });
        }}
        className="space-y-4"
      >
        <TabsList className="bg-muted/50 w-full justify-start overflow-x-auto overflow-y-hidden scrollbar-none">
          <TabsTrigger value="overview" className="gap-1.5 text-xs shrink-0">
            <BarChart3 className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="rewards" className="gap-1.5 text-xs shrink-0">
            <Coins className="h-3.5 w-3.5" /> Rewards
          </TabsTrigger>
          <TabsTrigger value="caps" className="gap-1.5 text-xs shrink-0">
            <Sliders className="h-3.5 w-3.5" /> Reward Caps
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
          <TabsTrigger value="ip" className="gap-1.5 text-xs shrink-0">
            <ShieldCheck className="h-3.5 w-3.5" /> IP Verifications
          </TabsTrigger>
          <TabsTrigger value="artists" className="gap-1.5 text-xs shrink-0">
            <ShieldCheck className="h-3.5 w-3.5" /> Artist Verification
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
          <TabsTrigger value="capital" className="gap-1.5 text-xs shrink-0">
            <Sliders className="h-3.5 w-3.5" /> Capital
          </TabsTrigger>
          <TabsTrigger value="fees" className="gap-1.5 text-xs shrink-0">
            <Percent className="h-3.5 w-3.5" /> Fees
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><AdminOverview /></TabsContent>
        <TabsContent value="rewards"><AdminPendingRewards /></TabsContent>
        <TabsContent value="caps"><AdminRewardCaps /></TabsContent>
        <TabsContent value="users"><AdminUsers /></TabsContent>
        <TabsContent value="badges"><AdminBadges /></TabsContent>
        <TabsContent value="studios"><AdminStudioApplications /></TabsContent>
        <TabsContent value="ip"><AdminWorkVerifications /></TabsContent>
        <TabsContent value="artists"><AdminArtistVerifications /></TabsContent>
        <TabsContent value="disputes"><AdminDisputes /></TabsContent>
        <TabsContent value="withdrawals"><AdminWithdrawals /></TabsContent>
        <TabsContent value="moderation"><AdminContentModeration /></TabsContent>
        <TabsContent value="capital" className="space-y-4">
          <AdminUnderwritingRules />
          <AdminUnderwritingRulesAudit />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPage;
