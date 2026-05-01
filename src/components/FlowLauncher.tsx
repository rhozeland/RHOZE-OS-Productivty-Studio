/**
 * FlowLauncher — persistent "Enter Flow" floating action button.
 *
 * Mounted globally in AppLayout so signed-in users can launch the immersive
 * Flow swipe feed from anywhere. Hidden when:
 *   - user is unauthenticated (Flow requires auth context for personalization)
 *   - the user is already on /flow (avoid self-link)
 *   - the user is on /auth (no FAB during sign-in flows)
 *
 * Sits above the dock but below modal content, with a small label that
 * collapses on scroll-down to reduce footprint on long pages.
 */
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Flame } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const HIDDEN_PREFIXES = ["/flow", "/auth", "/onboarding"];

const FlowLauncher = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [compact, setCompact] = useState(false);

  // Collapse to icon-only after the user scrolls so it never fights with content
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > 80 && y > lastY) setCompact(true);
      else if (y < 40) setCompact(false);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!user) return null;
  if (HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <AnimatePresence>
      <motion.button
        key="flow-launcher"
        type="button"
        onClick={() => navigate("/flow")}
        initial={{ opacity: 0, scale: 0.85, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: 12 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        // Anchored bottom-right, sitting above the dock (which has its own
        // bottom offset). On mobile, dock is centered so we hug right edge.
        className={cn(
          "fixed z-40 rounded-full shadow-lg",
          "bg-foreground text-background",
          "border border-border/40 backdrop-blur",
          "transition-all duration-300",
          // Bottom offset: sits above the dock on desktop and tablet,
          // tucks into the corner on mobile where dock is wider.
          "bottom-24 right-4 md:bottom-28 md:right-6",
          compact ? "h-12 w-12 px-0" : "h-12 px-4",
          "flex items-center gap-2",
        )}
        aria-label="Enter Flow mode"
      >
        <Flame className="h-4 w-4 shrink-0 fill-amber-400/40 text-amber-400" />
        <AnimatePresence initial={false}>
          {!compact && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="text-xs font-medium whitespace-nowrap overflow-hidden"
            >
              Enter Flow
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </AnimatePresence>
  );
};

export default FlowLauncher;
