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
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Shield,
  ShoppingBag,
  CalendarDays,
  ArrowRight,
  Briefcase,
  Search,
  Users,
  ChevronLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuthGate } from "@/components/AuthGateDialog";
import CreateListingDialog from "@/components/marketplace/CreateListingDialog";
import RhozeRewardBadge from "@/components/RhozeRewardBadge";
import { cn } from "@/lib/utils";

type ListingKind = "service" | "project_request" | "collaboration";

const LISTING_SUB_OPTIONS: {
  key: ListingKind;
  title: string;
  description: string;
  Icon: typeof Briefcase;
  accent: string;
  iconClass: string;
}[] = [
  {
    key: "service",
    title: "Offering a Service",
    description: "I can do this for you.",
    Icon: Briefcase,
    accent: "from-sky-500/20 to-sky-500/5",
    iconClass: "text-sky-500",
  },
  {
    key: "project_request",
    title: "Looking for Help",
    description: "I need someone to do this.",
    Icon: Search,
    accent: "from-amber-500/20 to-amber-500/5",
    iconClass: "text-amber-500",
  },
  {
    key: "collaboration",
    title: "Seeking Collaborators",
    description: "Let's work on this together.",
    Icon: Users,
    accent: "from-violet-500/20 to-violet-500/5",
    iconClass: "text-violet-500",
  },
];

interface PostMenuButtonProps {
  /** Optional custom trigger. Defaults to the compact "+ Post" pill. */
  trigger?: ReactNode;
}

const OptionCard = ({
  Icon,
  title,
  description,
  accent,
  iconClass,
  reward,
  onClick,
}: {
  Icon: typeof Briefcase;
  title: string;
  description: string;
  accent: string;
  iconClass: string;
  reward?: number;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "group relative w-full text-left rounded-2xl border border-border bg-gradient-to-br p-4 hover:border-foreground/40 hover:shadow-md transition-all",
      accent,
    )}
  >
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-xl bg-background/80 backdrop-blur-sm flex items-center justify-center shrink-0">
        <Icon className={cn("h-5 w-5", iconClass)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-display font-semibold text-sm text-foreground">{title}</p>
          {reward !== undefined && <RhozeRewardBadge amount={reward} />}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
    </div>
  </button>
);

const PostMenuButton = ({ trigger }: PostMenuButtonProps = {}) => {
  const navigate = useNavigate();
  const { requireAuth } = useAuthGate();
  const [open, setOpen] = useState(false);
  const [showListingSubOptions, setShowListingSubOptions] = useState(false);
  const [createListingOpen, setCreateListingOpen] = useState(false);
  const [listingType, setListingType] = useState<ListingKind>("service");

  const handleOpen = () => {
    if (!requireAuth("post")) return;
    setShowListingSubOptions(false);
    setOpen(true);
  };

  const closeAndNavigate = (to: string) => {
    setOpen(false);
    setShowListingSubOptions(false);
    navigate(to);
  };

  const closeAndOpenListing = (kind: ListingKind) => {
    setListingType(kind);
    setOpen(false);
    setShowListingSubOptions(false);
    // Defer open so the first dialog finishes closing cleanly.
    requestAnimationFrame(() => setCreateListingOpen(true));
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
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:bg-foreground/90 transition-colors shadow-sm"
          aria-label="Create a post"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Post</span>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              {showListingSubOptions && (
                <button
                  type="button"
                  onClick={() => setShowListingSubOptions(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Back"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              {showListingSubOptions ? "What kind of listing?" : "What are you posting?"}
            </DialogTitle>
            <DialogDescription>
              {showListingSubOptions
                ? "Pick the listing format that fits."
                : "Pick a format. We'll take you to the right flow."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 mt-2">
            {!showListingSubOptions ? (
              <>
                <OptionCard
                  Icon={Shield}
                  title="Post Work"
                  description="Register a file as Verified IP — audio, image, video, text."
                  accent="from-emerald-500/20 to-emerald-500/5"
                  iconClass="text-emerald-500"
                  onClick={() => closeAndNavigate("/settings#provenance")}
                />
                <OptionCard
                  Icon={ShoppingBag}
                  title="Post a Listing"
                  description="Sell a service, ask for help, or find collaborators."
                  accent="from-sky-500/20 to-sky-500/5"
                  iconClass="text-sky-500"
                  onClick={() => setShowListingSubOptions(true)}
                />
                <OptionCard
                  Icon={CalendarDays}
                  title="Post an Event"
                  description="Host a show, workshop, screening, or meetup."
                  accent="from-pink-500/20 to-pink-500/5"
                  iconClass="text-pink-500"
                  onClick={() => closeAndNavigate("/spaces/events/new")}
                />
              </>
            ) : (
              LISTING_SUB_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.key}
                  Icon={opt.Icon}
                  title={opt.title}
                  description={opt.description}
                  accent={opt.accent}
                  iconClass={opt.iconClass}
                  onClick={() => closeAndOpenListing(opt.key)}
                />
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CreateListingDialog
        open={createListingOpen}
        onOpenChange={setCreateListingOpen}
        prefill={{ listing_type: listingType }}
      />
    </>
  );
};

export default PostMenuButton;
