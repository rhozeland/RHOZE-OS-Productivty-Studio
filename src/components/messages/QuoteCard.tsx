import { useState } from "react";
import { FileText, Clock, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type QuoteCardProps = {
  content: string;
  isMine: boolean;
  messageId: string;
  senderId: string;
};

const QuoteCard = ({ content, isMine, messageId, senderId }: QuoteCardProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [acting, setActing] = useState(false);

  // Parse the structured quote message
  const lines = content.split("\n").filter(Boolean);
  const titleLine = lines.find((l) => l.startsWith("**") && !l.startsWith("**Quote"));
  const title = titleLine?.replace(/\*\*/g, "").trim() || "Quote";

  const milestoneLines = lines.filter((l) => /^\s+\d+\./.test(l));
  const totalLine = lines.find((l) => l.includes("Total:"));
  const total = totalLine?.match(/(\d+)\s*credits/)?.[1] || "0";
  const contractIdMatch = content.match(/Contract ID:\s*([a-f0-9-]+)/);
  const contractId = contractIdMatch?.[1];

  // Check for status in content
  const isAccepted = content.includes("✅ **Accepted**");
  const isDeclined = content.includes("❌ **Declined**");
  const hasResponse = isAccepted || isDeclined;

  // Show buttons only to the recipient (not the sender) and only if no response yet
  const showActions = !isMine && !hasResponse && !!contractId;

  const notesLines = lines.filter(
    (l) =>
      !l.startsWith("📋") &&
      !l.startsWith("**") &&
      !l.startsWith("Milestones:") &&
      !/^\s+\d+\./.test(l) &&
      !l.includes("Total:") &&
      !l.includes("Contract ID:") &&
      !l.includes("✅") &&
      !l.includes("❌") &&
      l.trim()
  );

  const handleRespond = async (accept: boolean) => {
    if (!contractId || !user) return;
    setActing(true);
    try {
      if (accept) {
        // Call escrow edge function to atomically lock credits
        const { data, error: fnErr } = await supabase.functions.invoke("escrow-lock", {
          body: { contract_id: contractId },
        });
        if (fnErr) throw fnErr;
        if (data?.error) throw new Error(data.error);
      } else {
        // Decline: just update contract status
        const { error: contractErr } = await supabase
          .from("project_contracts")
          .update({ status: "declined" })
          .eq("id", contractId);
        if (contractErr) throw contractErr;
      }

      // Send a response message
      const responseMsg = accept
        ? `✅ **Accepted** the quote for **${title}** (${total} credits locked in escrow)`
        : `❌ **Declined** the quote for **${title}**`;

      const { error: msgErr } = await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: senderId,
        content: responseMsg,
      });
      if (msgErr) throw msgErr;

      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success(accept ? "Quote accepted — credits locked in escrow!" : "Quote declined");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActing(false);
    }
  };

  return (
    <div
      className={cn(
        "max-w-[85%] rounded-2xl border overflow-hidden",
        isMine
          ? "bg-primary/5 border-primary/20"
          : "bg-muted/50 border-border"
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center gap-2 px-4 py-2.5 border-b border-border/50",
        isAccepted ? "bg-green-500/10" : isDeclined ? "bg-destructive/10" : "bg-primary/5"
      )}>
        <FileText className={cn(
          "h-4 w-4",
          isAccepted ? "text-green-600" : isDeclined ? "text-destructive" : "text-primary"
        )} />
        <span className={cn(
          "text-xs font-medium",
          isAccepted ? "text-green-600" : isDeclined ? "text-destructive" : "text-primary"
        )}>
          {isAccepted ? "Quote — Accepted" : isDeclined ? "Quote — Declined" : "Quote"}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Title */}
        <h4 className="font-display font-semibold text-foreground text-sm">
          {title}
        </h4>

        {/* Notes */}
        {notesLines.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {notesLines.join(" ")}
          </p>
        )}

        {/* Milestones */}
        {milestoneLines.length > 0 && (
          <div className="space-y-1.5">
            {milestoneLines.map((line, i) => {
              const match = line.match(/\d+\.\s*(.+?)\s*—\s*(\d+)\s*credits/);
              if (!match) return null;
              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md bg-background/60 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-foreground">{match[1]}</span>
                  </div>
                  <span className="text-xs font-medium text-primary">
                    {match[2]}c
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Total */}
        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <span className="text-xs font-medium text-muted-foreground">
            Total
          </span>
          <span className="font-display text-sm font-bold text-primary">
            {total} credits
          </span>
        </div>

        {/* Accept/Decline buttons */}
        {showActions && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 h-8 gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleRespond(true)}
              disabled={acting}
            >
              <Check className="h-3.5 w-3.5" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 gap-1.5 text-xs hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => handleRespond(false)}
              disabled={acting}
            >
              <X className="h-3.5 w-3.5" />
              Decline
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuoteCard;

export const isQuoteMessage = (content: string): boolean => {
  return content.startsWith("📋 **Quote Sent**");
};
