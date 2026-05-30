/**
 * PostMenuButton — single "+ Post" entry point.
 *
 * v11 Pillar 8 (current): clicking Post anywhere on Rhozeland sends the user
 * straight to the Share-to-Flow composer (`/flow?share=1`). No more Work /
 * Listing / Event / Space picker — listings, events, and spaces are admin/
 * tiered surfaces and have their own dedicated CTAs elsewhere.
 *
 * The one exception is the Marketplace "Post a Listing" button, which opts in
 * by passing `intent="listing"`. That path opens the existing
 * `<CreateListingDialog />` directly.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAuthGate } from "@/components/AuthGateDialog";
import CreateListingDialog from "@/components/marketplace/CreateListingDialog";
import { todayGradient } from "@/lib/rhoze-gradients";

interface PostMenuButtonProps {
  /** Optional custom trigger. Defaults to the compact "+ Post" pill. */
  trigger?: ReactNode;
  /** "post" (default → Share-to-Flow) or "listing" (→ marketplace dialog). */
  intent?: "post" | "listing";
}

const PostMenuButton = ({ trigger, intent = "post" }: PostMenuButtonProps = {}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { requireAuth } = useAuthGate();
  const [createListingOpen, setCreateListingOpen] = useState(false);

  const handleClick = () => {
    if (!requireAuth("post")) return;
    if (intent === "listing") {
      setCreateListingOpen(true);
      return;
    }
    navigate("/flow?share=1");
  };

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

  return (
    <>
      {trigger ? (
        <span onClick={handleClick} className="contents">
          {trigger}
        </span>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="group relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-transform hover:scale-[1.03] active:scale-[0.98] bg-[length:200%_200%] animate-gradient-shift"
          style={{ backgroundImage: `linear-gradient(120deg, hsl(${todayGradient().stops[0]}), hsl(${todayGradient().stops[1]}), hsl(${todayGradient().stops[2]}), hsl(${todayGradient().stops[0]}))` }}
          aria-label="Create a post"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Post</span>
        </button>
      )}

      <CreateListingDialog
        open={createListingOpen}
        onOpenChange={setCreateListingOpen}
      />
    </>
  );
};

export default PostMenuButton;
