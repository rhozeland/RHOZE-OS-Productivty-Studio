/**
 * RepostButton — small action that toggles a row in `flow_reposts`.
 *
 * Used inside FlowCard's action bar. When a signed-in viewer reposts a Flow
 * item the row appears on their own profile under the new "Reposts" tab.
 * Anonymous viewers are routed to /auth.
 */
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Repeat2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  flowItemId: string;
  ownerId?: string | null;
}

const RepostButton = ({ flowItemId, ownerId }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const prefersReducedMotion = useReducedMotion();
  const isOwn = !!user && ownerId && user.id === ownerId;

  // viewer-specific "did I repost this?" — cheap, scoped per-user
  const { data: mine } = useQuery({
    queryKey: ["flow-repost-mine", flowItemId, user?.id],
    enabled: !!user && !isOwn,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flow_reposts")
        .select("id")
        .eq("flow_item_id", flowItemId)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
  });

  // public repost count
  const { data: count } = useQuery({
    queryKey: ["flow-repost-count", flowItemId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("flow_reposts")
        .select("id", { count: "exact", head: true })
        .eq("flow_item_id", flowItemId);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const toggle = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to repost");
      if (mine) {
        const { error } = await supabase
          .from("flow_reposts")
          .delete()
          .eq("id", mine);
        if (error) throw error;
        return { reposted: false };
      }
      const { error } = await supabase
        .from("flow_reposts")
        .insert({ user_id: user.id, flow_item_id: flowItemId });
      if (error) throw error;
      return { reposted: true };
    },
    onSuccess: ({ reposted }) => {
      qc.invalidateQueries({ queryKey: ["flow-repost-mine", flowItemId, user?.id] });
      qc.invalidateQueries({ queryKey: ["flow-repost-count", flowItemId] });
      if (user) qc.invalidateQueries({ queryKey: ["profile-reposts", user.id] });
      toast.success(reposted ? "Reposted to your profile" : "Repost removed");
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not repost"),
  });

  if (isOwn) return null;

  const reposted = !!mine;

  return (
    <motion.button
      type="button"
      aria-pressed={reposted}
      aria-label={reposted ? "Remove repost" : "Repost"}
      title={user ? (reposted ? "Tap to remove repost" : "Repost to your profile") : "Sign in to repost"}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
      onClick={(e) => {
        e.stopPropagation();
        if (!user) {
          navigate("/auth");
          return;
        }
        toggle.mutate();
      }}
      disabled={toggle.isPending}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2 py-1 -mx-2 transition-all",
        reposted
          ? "text-emerald-600 bg-emerald-500/10"
          : "text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/5",
        toggle.isPending && "opacity-60 cursor-wait",
      )}
    >
      <Repeat2 className="h-[18px] w-[18px]" />
      <span className="text-[11px] font-semibold tabular-nums">
        {count && count > 0 ? count : "Repost"}
      </span>
    </motion.button>
  );
};

export default RepostButton;
