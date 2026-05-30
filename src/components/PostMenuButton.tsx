/**
 * PostMenuButton — unified create entry point.
 *
 * Single source of truth for the "What are you posting?" modal. Used by:
 *   • The persistent "+ Post" pill in the top nav (default trigger).
 *   • The Marketplace page's "Post a Listing" CTA (custom trigger).
 *
 * Modal options:
 *   1. Post Work       → /settings#provenance (Verified IP register flow)
 *   2. Post a Listing  → expands inline into 3 sub-options
 *        - Offering a Service  (listing_type=service)
 *        - Looking for Help    (listing_type=project_request)
 *        - Seeking Collaborators (listing_type=collaboration)
 *      Each opens CreateListingDialog skipping its own picker step.
 *   3. Post an Event   → /spaces/events/new
 */
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  Shield,
  CalendarDays,
  Building2,
  Briefcase,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthGate } from "@/components/AuthGateDialog";
import CreateListingDialog from "@/components/marketplace/CreateListingDialog";
import { cn } from "@/lib/utils";
import { todayGradient } from "@/lib/rhoze-gradients";

type PostIntent = {
  key: "note" | "work" | "listing" | "event" | "space";
  title: string;
  description: string;
  cta: string;
  Icon: typeof Shield;
};

// Pillar 6: dropped "Update" (notes are accessible from DMs/profile only) — the
// public Post menu is now about durable artifacts: works, listings, events, spaces.
const POST_OPTIONS: PostIntent[] = [
  {
    key: "work",
    title: "Work",
    description: "Drop music, video, or photo. Hashed in your browser.",
    cta: "Share to Flow",
    Icon: Shield,
  },

  {
    key: "listing",
    title: "Listing",
    description: "Offer a service, ask for help, or find collaborators.",
    cta: "Create listing",
    Icon: Briefcase,
  },
  {
    key: "event",
    title: "Event",
    description: "Create a live show, meetup, workshop, or screening.",
    cta: "Create event",
    Icon: CalendarDays,
  },
  {
    key: "space",
    title: "Space",
    description: "List a studio, venue, or creative space.",
    cta: "List space",
    Icon: Building2,
  },
];

interface PostMenuButtonProps {
  /** Optional custom trigger. Defaults to the compact "+ Post" pill. */
  trigger?: ReactNode;
}

const PostMenuButton = ({ trigger }: PostMenuButtonProps = {}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { requireAuth } = useAuthGate();
  const [open, setOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [createListingOpen, setCreateListingOpen] = useState(false);
  const [selected, setSelected] = useState<PostIntent["key"]>("work");

  const handleOpen = () => {
    if (!requireAuth("post")) return;
    setOpen(true);
  };

  useEffect(() => {
    if (searchParams.get("post") !== "1") return;

    if (requireAuth("post")) {
      setSelected("work");
      setOpen(true);
    }

    const next = new URLSearchParams(searchParams);
    next.delete("post");
    setSearchParams(next, { replace: true });
  }, [requireAuth, searchParams, setSearchParams]);

  const closeAndNavigate = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  const selectedOption = POST_OPTIONS.find((option) => option.key === selected) ?? POST_OPTIONS[0];

  const handleContinue = () => {
    if (selected === "work") {
      // v11 Pillar 7 — straight into the Share-to-Flow composer. No settings
      // detour; verification is only required for the on-chain anchor toggle.
      closeAndNavigate("/flow?share=1");
      return;
    }


    if (selected === "listing") {
      setOpen(false);
      requestAnimationFrame(() => setCreateListingOpen(true));
      return;
    }

    if (selected === "event") {
      closeAndNavigate("/spaces/events/new");
      return;
    }

    closeAndNavigate("/studios/apply");
  };

  return (
    <>
      {trigger ? (
        <span onClick={handleOpen} className="contents">
          {trigger}
        </span>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className="group relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-transform hover:scale-[1.03] active:scale-[0.98] bg-[length:200%_200%] animate-gradient-shift"
          style={{ backgroundImage: `linear-gradient(120deg, hsl(${todayGradient().stops[0]}), hsl(${todayGradient().stops[1]}), hsl(${todayGradient().stops[2]}), hsl(${todayGradient().stops[0]}))` }}
          aria-label="Create a post"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Post</span>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl overflow-hidden border border-border/80 bg-card/95 p-0 backdrop-blur-xl">
          <div className="space-y-6 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {POST_OPTIONS.map((option) => {
                    const active = selected === option.key;
                    const Icon = option.Icon;

                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setSelected(option.key)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-medium transition-all",
                          active
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-secondary/55 text-muted-foreground hover:border-foreground/20 hover:bg-secondary hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{option.title}</span>
                      </button>
                    );
                  })}
                </div>

                <p className="text-sm text-muted-foreground max-w-2xl">
                  {selectedOption.description}
                </p>
              </div>

              <Button
                type="button"
                onClick={handleContinue}
                className="rounded-full px-6 py-6 text-base font-semibold"
              >
                <Plus className="mr-2 h-4 w-4" />
                {selectedOption.cta}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CreateListingDialog
        open={createListingOpen}
        onOpenChange={setCreateListingOpen}
      />
    </>
  );
};

export default PostMenuButton;
