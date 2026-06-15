/**
 * PostMenuButton — single "+ Post" entry point.
 *
 * v11 Pillar 9 (current): three options surface in a dropdown —
 *   • Post a work       → Share-to-Flow composer (/flow?share=1)
 *   • Post an update    → <AnnouncementComposerDialog /> (also fans out to Flow)
 *   • Post an opportunity → <CreateListingDialog /> (marketplace listing)
 *
 * `intent="listing"` short-circuits to opening the listing dialog directly (used
 * by the Marketplace "Post a Listing" button).
 */
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Sparkles, Megaphone, Briefcase } from "lucide-react";
import { useAuthGate } from "@/components/AuthGateDialog";
import CreateListingDialog from "@/components/marketplace/CreateListingDialog";
import AnnouncementComposerDialog from "@/components/profile/AnnouncementComposerDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { todayGradient } from "@/lib/rhoze-gradients";

interface PostMenuButtonProps {
  /** Optional custom trigger. Defaults to the compact "+ Post" pill. */
  trigger?: ReactNode;
  /** "post" (default → menu) or "listing" (→ marketplace dialog only). */
  intent?: "post" | "listing";
}

const PostMenuButton = ({ trigger, intent = "post" }: PostMenuButtonProps = {}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { requireAuth } = useAuthGate();
  const [createListingOpen, setCreateListingOpen] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const gate = () => requireAuth("post");

  const openWork = () => { if (gate()) navigate("/flow?share=1"); };
  const openUpdate = () => { if (gate()) setAnnounceOpen(true); };
  const openListing = () => { if (gate()) setCreateListingOpen(true); };

  // Legacy `?post=1` deep-link → Share-to-Flow.
  useEffect(() => {
    if (searchParams.get("post") !== "1") return;
    if (requireAuth("post")) {
      navigate("/flow?share=1", { replace: true });
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("post");
    setSearchParams(next, { replace: true });
  }, [requireAuth, searchParams, setSearchParams, navigate]);

  // Listing-only mode: skip dropdown.
  if (intent === "listing") {
    return (
      <>
        {trigger ? (
          <span onClick={openListing} className="contents">{trigger}</span>
        ) : (
          <button
            type="button"
            onClick={openListing}
            className="group relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-transform hover:scale-[1.03] active:scale-[0.98] bg-[length:200%_200%] animate-gradient-shift"
            style={{ backgroundImage: `linear-gradient(120deg, hsl(${todayGradient().stops[0]}), hsl(${todayGradient().stops[1]}), hsl(${todayGradient().stops[2]}), hsl(${todayGradient().stops[0]}))` }}
            aria-label="Post a listing"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Post</span>
          </button>
        )}
        <CreateListingDialog open={createListingOpen} onOpenChange={setCreateListingOpen} />
      </>
    );
  }

  const triggerEl = trigger ?? (
    <button
      type="button"
      className="group relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-transform hover:scale-[1.03] active:scale-[0.98] bg-[length:200%_200%] animate-gradient-shift"
      style={{ backgroundImage: `linear-gradient(120deg, hsl(${todayGradient().stops[0]}), hsl(${todayGradient().stops[1]}), hsl(${todayGradient().stops[2]}), hsl(${todayGradient().stops[0]}))` }}
      aria-label="Create a post"
    >
      <Plus className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Post</span>
    </button>
  );

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={(o) => {
        if (o && !gate()) return;
        setMenuOpen(o);
      }}>
        <DropdownMenuTrigger asChild>
          {trigger ? <span className="contents">{triggerEl}</span> : triggerEl}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onClick={openWork} className="gap-3 py-2.5">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">Post a work</span>
              <span className="text-[11px] text-muted-foreground">Audio · video · photo to Flow</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openUpdate} className="gap-3 py-2.5">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">Post an update</span>
              <span className="text-[11px] text-muted-foreground">Short announcement for your fans</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openListing} className="gap-3 py-2.5">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">Post an opportunity</span>
              <span className="text-[11px] text-muted-foreground">Service, open call, or collab brief</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateListingDialog open={createListingOpen} onOpenChange={setCreateListingOpen} />
      <AnnouncementComposerDialog open={announceOpen} onOpenChange={setAnnounceOpen} />
    </>
  );
};

export default PostMenuButton;
