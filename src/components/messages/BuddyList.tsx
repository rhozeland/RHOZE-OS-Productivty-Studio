import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Profile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

interface BuddyListProps {
  onSelectUser: (profile: Profile) => void;
  selectedUserId?: string;
}

const BuddyList = ({ onSelectUser, selectedUserId }: BuddyListProps) => {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(true);

  // Recent contacts: people user has messaged recently
  const { data: recentContacts } = useQuery({
    queryKey: ["buddy-list", user?.id],
    queryFn: async () => {
      // Get recent unique conversation partners
      const { data: msgs, error } = await supabase
        .from("messages")
        .select("sender_id, receiver_id, created_at")
        .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const seen = new Set<string>();
      const partnerIds: string[] = [];
      for (const msg of msgs) {
        const partnerId = msg.sender_id === user!.id ? msg.receiver_id : msg.sender_id;
        if (!seen.has(partnerId)) {
          seen.add(partnerId);
          partnerIds.push(partnerId);
          if (partnerIds.length >= 10) break;
        }
      }

      if (partnerIds.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase.rpc("get_profiles_by_ids", { _ids: partnerIds });
      if (pErr) throw pErr;

      // Keep original order
      const profileMap = new Map((profiles as Profile[]).map((p) => [p.user_id, p]));
      return partnerIds.map((id) => profileMap.get(id)).filter(Boolean) as Profile[];
    },
    enabled: !!user,
  });

  if (!recentContacts?.length) return null;

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Recent Contacts
      </button>
      {expanded && (
        <ScrollArea className="max-h-48">
          {recentContacts.map((p) => (
            <button
              key={p.user_id}
              onClick={() => onSelectUser(p)}
              className={cn(
                "flex w-full items-center gap-2.5 px-4 py-1.5 text-left transition-colors hover:bg-muted/50",
                selectedUserId === p.user_id && "bg-muted/70"
              )}
            >
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  <User className="h-3.5 w-3.5 text-primary" />
                )}
              </div>
              <span className="text-xs font-medium text-foreground truncate">{p.display_name || "Creator"}</span>
            </button>
          ))}
        </ScrollArea>
      )}
    </div>
  );
};

export default BuddyList;
