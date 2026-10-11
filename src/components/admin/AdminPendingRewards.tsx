import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle, XCircle, Loader2, Coins, Clock, Filter,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

const ACTION_LABELS: Record<string, string> = {
  flow_post: "Flow Post",
  flow_interaction: "Flow Like/Save",
  review: "Review",
  milestone_approved: "Milestone Approved",
  drop_room_post: "Drop Room Post",
};

const AdminPendingRewards = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: rewards, isLoading } = useQuery({
    queryKey: ["admin-pending-rewards", statusFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_rewards")
        .select("*")
        .eq("status", statusFilter)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch display names for user_ids
  const userIds = [...new Set((rewards ?? []).map((r: any) => r.user_id))];
  const { data: profiles } = useQuery({
    queryKey: ["reward-profiles", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      const { data } = await supabase.rpc("get_profiles_by_ids", { _ids: userIds });
      const map: Record<string, any> = {};
      data?.forEach((p: any) => { map[p.user_id] = p; });
      return map;
    },
    enabled: userIds.length > 0,
  });

  const approveMutation = useMutation({
    mutationFn: async (rewardId: string) => {
      const { error } = await supabase.rpc("approve_pending_reward", {
        _reward_id: rewardId,
        _admin_id: user!.id,
        _note: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-rewards"] });
      toast.success("Reward approved and credited!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async (rewardId: string) => {
      const { error } = await supabase.rpc("reject_pending_reward", {
        _reward_id: rewardId,
        _admin_id: user!.id,
        _note: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-rewards"] });
      toast.success("Reward rejected");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const batchApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc("approve_pending_rewards_batch", {
        _reward_ids: ids,
        _admin_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-rewards"] });
      setSelected(new Set());
      toast.success("Batch approved!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!rewards) return;
    if (selected.size === rewards.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rewards.map((r: any) => r.id)));
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {(["pending", "approved", "rejected"] as const).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => { setStatusFilter(s); setSelected(new Set()); }}
              className="capitalize text-xs"
            >
              {s}
            </Button>
          ))}
        </div>
        {statusFilter === "pending" && selected.size > 0 && (
          <Button
            size="sm"
            onClick={() => batchApproveMutation.mutate([...selected])}
            disabled={batchApproveMutation.isPending}
            className="gap-1.5"
          >
            {batchApproveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
            Approve {selected.size} selected
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !rewards || rewards.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No {statusFilter} rewards found.
        </div>
      ) : (
        <div className="space-y-2">
          {statusFilter === "pending" && (
            <div className="flex items-center gap-2 px-2 pb-1">
              <Checkbox
                checked={selected.size === rewards.length && rewards.length > 0}
                onCheckedChange={selectAll}
              />
              <span className="text-xs text-muted-foreground">Select all ({rewards.length})</span>
            </div>
          )}
          {rewards.map((reward: any) => {
            const profile = profiles?.[reward.user_id];
            return (
              <motion.div
                key={reward.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/60"
              >
                {statusFilter === "pending" && (
                  <Checkbox
                    checked={selected.has(reward.id)}
                    onCheckedChange={() => toggleSelect(reward.id)}
                  />
                )}
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Coins className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {profile?.display_name || "User"}
                    </span>
                    <Badge variant="outline" className="text-[9px]">
                      {ACTION_LABELS[reward.action_type] || reward.action_type}
                    </Badge>
                    <span className="text-xs font-semibold text-primary">+{reward.amount}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{reward.description}</p>
                  <p className="text-[10px] text-muted-foreground/60">
                    {formatDistanceToNow(new Date(reward.created_at), { addSuffix: true })}
                  </p>
                </div>
                {statusFilter === "pending" && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 gap-1 text-xs text-emerald-600 hover:bg-emerald-500/10"
                      onClick={() => approveMutation.mutate(reward.id)}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle className="h-3 w-3" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 gap-1 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => rejectMutation.mutate(reward.id)}
                      disabled={rejectMutation.isPending}
                    >
                      <XCircle className="h-3 w-3" /> Reject
                    </Button>
                  </div>
                )}
                {statusFilter !== "pending" && (
                  <Badge variant={reward.status === "approved" ? "default" : "destructive"} className="text-[10px]">
                    {reward.status}
                  </Badge>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminPendingRewards;
