/**
 * SupportCreatorSheet — the umbrella "Back this creator" entry point.
 *
 * Opens from the primary CTA at the top of the Support tab and lists every
 * way to back a creator in one place, in this order of conviction:
 *
 *   1. Back their career  → opens <InvestUnlockSheet /> (Artist Shares)
 *   2. Show up            → routes to their first upcoming event/space
 *   3. Work with them     → opens the booking dialog (services / sessions)
 *   4. Send a tip / DM    → routes to /messages
 *
 * Soft-mention crypto framing: no "$RHOZE", "mint", "bonding curve" words
 * appear in the labels — only "Shares" + a quiet "How this works →" link.
 *
 * Parent component is responsible for actually opening the booking dialog
 * (via onWorkWithThem) and the invest sheet (via onBackCareer) so we don't
 * stack three modals at once on mobile.
 */
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Calendar as CalendarIcon,
  Briefcase,
  MessageSquare,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  artistName: string;
  hasShares: boolean;
  hasHappenings: boolean;
  hasOfferings: boolean;
  isAvailableForBooking: boolean;
  onBackCareer: () => void;
  onShowUp: () => void;
  onWorkWithThem: () => void;
  onSendMessage: () => void;
}

const SupportCreatorSheet = ({
  open,
  onOpenChange,
  artistName,
  hasShares,
  hasHappenings,
  hasOfferings,
  isAvailableForBooking,
  onBackCareer,
  onShowUp,
  onWorkWithThem,
  onSendMessage,
}: Props) => {
  const options: {
    key: string;
    icon: typeof Sparkles;
    label: string;
    blurb: string;
    accent: string;
    enabled: boolean;
    onClick: () => void;
    badge?: string;
  }[] = [
    {
      key: "shares",
      icon: TrendingUp,
      label: "Back their career",
      blurb: "Buy a Share and own a slice of the upside.",
      accent: "from-emerald-500/15 to-emerald-500/0 border-emerald-500/30",
      enabled: hasShares,
      onClick: () => {
        onOpenChange(false);
        onBackCareer();
      },
      badge: "Strongest signal",
    },
    {
      key: "happen",
      icon: Sparkles,
      label: "Show up",
      blurb: "Pull up to an event or space they're hosting.",
      accent: "from-fuchsia-500/15 to-fuchsia-500/0 border-fuchsia-500/30",
      enabled: hasHappenings,
      onClick: () => {
        onOpenChange(false);
        onShowUp();
      },
    },
    {
      key: "work",
      icon: Briefcase,
      label: "Work with them",
      blurb: "Hire them for a session, commission, or collab.",
      accent: "from-amber-500/15 to-amber-500/0 border-amber-500/30",
      enabled: hasOfferings || isAvailableForBooking,
      onClick: () => {
        onOpenChange(false);
        onWorkWithThem();
      },
    },
    {
      key: "tip",
      icon: MessageSquare,
      label: "Send a message",
      blurb: "Say hi, drop a tip, or pitch an idea.",
      accent: "from-sky-500/15 to-sky-500/0 border-sky-500/30",
      enabled: true,
      onClick: () => {
        onOpenChange(false);
        onSendMessage();
      },
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="font-display text-xl">
            Back {artistName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pick a path. Every one of these counts as real support.
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 pb-4 space-y-2">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={opt.onClick}
                disabled={!opt.enabled}
                className={`group w-full text-left rounded-xl border bg-gradient-to-br ${opt.accent} bg-card/60 p-4 transition-colors hover:border-foreground/40 disabled:opacity-40 disabled:hover:border-border/50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-background/60 border border-border/60 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">
                        {opt.label}
                      </p>
                      {opt.badge && opt.enabled && (
                        <span className="text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          {opt.badge}
                        </span>
                      )}
                      {!opt.enabled && (
                        <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                          Not available yet
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {opt.blurb}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-6 pb-5 pt-1">
          <Link
            to="/credits?tab=how"
            onClick={() => onOpenChange(false)}
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            How this works <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SupportCreatorSheet;
