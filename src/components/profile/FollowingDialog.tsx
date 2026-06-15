import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Users, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
}

export default function FollowingDialog({ open, onOpenChange, userId }: Props) {
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["following-list", userId],
    queryFn: async () => {
      const { data: conns } = await supabase
        .from("connections")
        .select("following_id, created_at")
        .eq("follower_id", userId)
        .eq("type", "follow")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      const ids = (conns ?? []).map((c) => c.following_id).filter(Boolean);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, archetype")
        .in("id", ids);
      const order = new Map(ids.map((id, i) => [id, i]));
      return (profs ?? []).sort(
        (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
      );
    },
    enabled: open && !!userId,
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (p: any) =>
        (p.display_name || "").toLowerCase().includes(term) ||
        (p.username || "").toLowerCase().includes(term),
    );
  }, [data, q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Following
            <span className="text-xs font-normal text-muted-foreground">
              {data?.length ?? 0}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or @username"
            className="pl-9"
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              {data?.length ? "No matches." : "You're not following anyone yet."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((p: any) => {
                const name = p.display_name || p.username || "Creator";
                const initials = name.slice(0, 2).toUpperCase();
                return (
                  <li key={p.id}>
                    <Link
                      to={`/profiles/${p.id}`}
                      onClick={() => onOpenChange(false)}
                      className="flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-muted/60 transition"
                    >
                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt={name}
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {name}
                        </p>
                        {p.username && (
                          <p className="text-xs text-muted-foreground truncate">
                            @{p.username}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
