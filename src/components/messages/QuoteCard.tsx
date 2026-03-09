import { FileText, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type QuoteCardProps = {
  content: string;
  isMine: boolean;
};

const QuoteCard = ({ content, isMine }: QuoteCardProps) => {
  // Parse the structured quote message
  const lines = content.split("\n").filter(Boolean);
  const titleLine = lines.find((l) => l.startsWith("**") && !l.startsWith("**Quote"));
  const title = titleLine?.replace(/\*\*/g, "").trim() || "Quote";
  
  const milestoneLines = lines.filter((l) => /^\s+\d+\./.test(l));
  const totalLine = lines.find((l) => l.includes("Total:"));
  const total = totalLine?.match(/(\d+)\s*credits/)?.[1] || "0";
  const contractLine = lines.find((l) => l.includes("Contract ID:"));
  
  // Extract notes - lines between title and "Milestones:" that aren't metadata
  const notesLines = lines.filter(
    (l) =>
      !l.startsWith("📋") &&
      !l.startsWith("**") &&
      !l.startsWith("Milestones:") &&
      !/^\s+\d+\./.test(l) &&
      !l.includes("Total:") &&
      !l.includes("Contract ID:") &&
      l.trim()
  );

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
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 bg-primary/5">
        <FileText className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium text-primary">Quote</span>
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
      </div>
    </div>
  );
};

export default QuoteCard;

export const isQuoteMessage = (content: string): boolean => {
  return content.startsWith("📋 **Quote Sent**");
};
