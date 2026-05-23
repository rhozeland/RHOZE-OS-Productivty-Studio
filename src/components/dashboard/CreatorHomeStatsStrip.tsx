/**
 * CreatorHomeStatsStrip — 3-stat strip shown on the Home page in Creator mode.
 *
 * Sits between the greeting and the rest of the dashboard. Matches the
 * stat-card style used elsewhere (icon + bold value + uppercase label) and
 * uses the existing surface-card utility so it blends with the design system.
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FolderKanban, Inbox, Coins } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const StatCard = ({
  to,
  label,
  value,
  icon: Icon,
  highlight = false,
}: {
  to: string;
  label: string;
  value: string | number;
  icon: any;
  highlight?: boolean;
}) => (
  <Link
    to={to}
    className={cn(
      "surface-card flex items-center gap-3 px-4 py-3 rounded-2xl transition-shadow hover:shadow-md",
      highlight && "border-l-4 border-l-primary",
    )}
  >
    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
      <Icon className="h-4 w-4 text-primary" />
    </div>
    <div className="min-w-0">
      <p className="font-display text-lg font-bold tabular-nums leading-none text-foreground">
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body mt-1">
        {label}
      </p>
    </div>
  </Link>
);

const CreatorHomeStatsStrip = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const sb: any = supabase;

  const { data: activeProjects = 0 } = useQuery({
    queryKey: ["creator-home-active-projects", userId],
    enabled: !!userId,
    queryFn: async () => {
      const owner: any = await sb
        .from("projects")
        .select("id,status")
        .eq("owner_id", userId);
      const collab: any = await sb
        .from("project_collaborators")
        .select("project_id")
        .eq("user_id", userId);
      const ids = (collab.data ?? []).map((r: any) => r.project_id);
      let collabProjects: any[] = [];
      if (ids.length) {
        const r: any = await sb.from("projects").select("id,status").in("id", ids);
        collabProjects = r.data ?? [];
      }
      const all = [...(owner.data ?? []), ...collabProjects];
      const seen = new Set<string>();
      return all
        .filter((p: any) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
        .filter((p: any) => !["completed", "cancelled", "archived"].includes(p.status ?? ""))
        .length;
    },
  });

  const { data: pendingInquiries = 0 } = useQuery({
    queryKey: ["creator-home-pending-inquiries", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count } = await supabase
        .from("listing_inquiries")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", userId)
        .eq("status", "pending");
      return count ?? 0;
    },
  });

  const { data: balance = 0 } = useQuery({
    queryKey: ["creator-home-rhoze-balance", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await sb
        .from("user_credits")
        .select("balance")
        .eq("user_id", userId)
        .maybeSingle();
      return Number(data?.balance ?? 0);
    },
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatCard
        to="/messages?tab=projects"
        label="Active Projects"
        value={activeProjects}
        icon={FolderKanban}
      />
      <StatCard
        to="/messages?tab=inquiries"
        label="Pending Inquiries"
        value={pendingInquiries}
        icon={Inbox}
        highlight={Number(pendingInquiries) > 0}
      />
      <StatCard
        to="/credits"
        label="$RHOZE Balance"
        value={Number(balance).toLocaleString()}
        icon={Coins}
      />
    </div>
  );
};

export default CreatorHomeStatsStrip;
