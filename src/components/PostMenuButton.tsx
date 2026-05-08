/**
 * PostMenuButton — persistent "+" in the top nav. Opens a small modal
 * with three create flows: Post Work · Post a Listing · Post an Event.
 *
 * Each option navigates to its existing create surface so we don't fork
 * the source of truth for any of them.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Shield, ShoppingBag, CalendarDays, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuthGate } from "@/components/AuthGateDialog";

const OPTIONS = [
  {
    key: "work",
    title: "Post Work",
    description: "Register a file as Verified IP — audio, image, video, text.",
    Icon: Shield,
    accent: "from-emerald-500/20 to-emerald-500/5",
    iconClass: "text-emerald-500",
    to: "/settings#provenance",
  },
  {
    key: "listing",
    title: "Post a Listing",
    description: "Sell a service, beat, or product on the marketplace.",
    Icon: ShoppingBag,
    accent: "from-sky-500/20 to-sky-500/5",
    iconClass: "text-sky-500",
    to: "/marketplace?new=1",
  },
  {
    key: "event",
    title: "Post an Event",
    description: "Host a show, workshop, screening, or meetup.",
    Icon: CalendarDays,
    accent: "from-pink-500/20 to-pink-500/5",
    iconClass: "text-pink-500",
    to: "/spaces/events/new",
  },
] as const;

const PostMenuButton = () => {
  const navigate = useNavigate();
  const { requireAuth } = useAuthGate();
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    if (!requireAuth("post")) return;
    setOpen(true);
  };

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:bg-foreground/90 transition-colors shadow-sm"
        aria-label="Create a post"
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Post</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">What are you posting?</DialogTitle>
            <DialogDescription>Pick a format. We'll take you to the right flow.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 mt-2">
            {OPTIONS.map(({ key, title, description, Icon, accent, iconClass, to }) => (
              <button
                key={key}
                onClick={() => go(to)}
                className={`group relative w-full text-left rounded-2xl border border-border bg-gradient-to-br ${accent} p-4 hover:border-foreground/40 hover:shadow-md transition-all`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-background/80 backdrop-blur-sm flex items-center justify-center shrink-0">
                    <Icon className={`h-5 w-5 ${iconClass}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-sm text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PostMenuButton;
