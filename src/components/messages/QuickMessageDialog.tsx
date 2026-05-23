import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, User, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useCanDm } from "@/hooks/useCanDm";
import SupportSheet from "@/components/profile/SupportSheet";

interface QuickMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientId: string;
  recipientName?: string;
  recipientAvatar?: string | null;
  prefillMessage?: string;
}

const QuickMessageDialog = ({
  open,
  onOpenChange,
  recipientId,
  recipientName = "Creator",
  recipientAvatar,
  prefillMessage = "",
}: QuickMessageDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState(prefillMessage);
  const [subSheetOpen, setSubSheetOpen] = useState(false);
  const { canDm, gated, loading: gateLoading } = useCanDm(recipientId);
  const locked = gated && !canDm && !!user && user.id !== recipientId;

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to send messages");
      const { error } = await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: recipientId,
        content: message.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Message sent to ${recipientName}`);
      setMessage("");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messages", recipientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
              {recipientAvatar ? (
                <img src={recipientAvatar} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                <User className="h-4 w-4 text-primary" />
              )}
            </div>
            Message {recipientName}
          </DialogTitle>
        </DialogHeader>
        {locked ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/40 bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Lock className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Subscribers-only DMs
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {recipientName} only accepts messages from active subscribers.
                    Subscribe from $5/mo to start a thread.
                  </p>
                </div>
              </div>
            </div>
            <Button className="w-full rounded-full gap-2" onClick={() => setSubSheetOpen(true)}>
              <Sparkles className="h-4 w-4" />
              Subscribe to unlock DMs
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (message.trim()) sendMutation.mutate();
            }}
            className="space-y-4"
          >
            <Textarea
              placeholder={`Write a message to ${recipientName}...`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              autoFocus
              disabled={gateLoading}
            />
            <Button
              type="submit"
              className="w-full rounded-full gap-2"
              disabled={!message.trim() || sendMutation.isPending || gateLoading}
            >
              {sendMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
              ) : (
                <><Send className="h-4 w-4" /> Send Message</>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
      <SupportSheet
        open={subSheetOpen}
        onOpenChange={setSubSheetOpen}
        creatorId={recipientId}
        creatorName={recipientName}
        initialTab="subscribe"
      />
    </Dialog>
  );
};

export default QuickMessageDialog;
