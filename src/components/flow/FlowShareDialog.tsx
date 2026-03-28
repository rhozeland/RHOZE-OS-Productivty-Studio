import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Send, Check } from "lucide-react";
import { toast } from "sonner";

interface FlowShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    title: string;
    category: string;
    file_url?: string | null;
    link_url?: string | null;
  } | null;
}

const FlowShareDialog = ({ open, onOpenChange, item }: FlowShareDialogProps) => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string[]>([]);

  const { data: users } = useQuery({
    queryKey: ["share-users", search],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .neq("user_id", user!.id)
        .limit(20);

      if (search.trim()) {
        query = query.ilike("display_name", `%${search.trim()}%`);
      }

      const { data } = await query;
      return data ?? [];
    },
    enabled: open && !!user,
  });

  const handleSend = async (recipientId: string) => {
    if (!item || !user) return;
    setSending(recipientId);

    try {
      const shareContent = JSON.stringify({
        type: "flow_share",
        item_id: item.id,
        title: item.title,
        category: item.category,
        file_url: item.file_url || null,
        link_url: item.link_url || null,
      });

      const { error } = await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: recipientId,
        content: shareContent,
      });

      if (error) throw error;

      setSent((prev) => [...prev, recipientId]);
      toast.success("Sent!");
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    } finally {
      setSending(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setSent([]); setSearch(""); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Send to</DialogTitle>
        </DialogHeader>

        {/* Preview of what's being shared */}
        {item && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50 mb-1">
            {item.file_url ? (
              <img src={item.file_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                {item.category.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{item.category}</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
            autoFocus
          />
        </div>

        {/* User list */}
        <div className="max-h-[280px] overflow-y-auto space-y-1 -mx-1 px-1">
          {users?.map((u) => {
            const isSent = sent.includes(u.user_id);
            const isSending = sending === u.user_id;
            return (
              <div
                key={u.user_id}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={u.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {(u.display_name || "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm font-medium text-foreground truncate">
                  {u.display_name || "User"}
                </span>
                <Button
                  size="sm"
                  variant={isSent ? "ghost" : "outline"}
                  className="rounded-full h-8 px-3 text-xs"
                  disabled={isSent || isSending}
                  onClick={() => handleSend(u.user_id)}
                >
                  {isSent ? (
                    <><Check className="h-3.5 w-3.5 mr-1" /> Sent</>
                  ) : isSending ? (
                    "Sending..."
                  ) : (
                    <><Send className="h-3.5 w-3.5 mr-1" /> Send</>
                  )}
                </Button>
              </div>
            );
          })}
          {users?.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              {search ? "No users found" : "No users to share with yet"}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FlowShareDialog;
