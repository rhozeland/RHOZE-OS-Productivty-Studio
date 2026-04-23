/**
 * SignUpToPostPrompt
 * ─────────────────────────────────────────────────────────────────────────
 * Lightweight inline popover shown when an unauthenticated visitor tries
 * to use a compose/upload control in Flow Mode.
 *
 * The wrapped trigger button stays clickable so the surface still feels
 * interactive, but instead of opening the upload sheet/dialog we surface
 * a compact "Sign up to post" popover with one-click navigation to /auth.
 *
 * Designed to wrap an existing trigger:
 *
 *   <SignUpToPostPrompt>
 *     <Button>...</Button>
 *   </SignUpToPostPrompt>
 *
 * The child must accept ref + onClick (any standard button works). Auth'd
 * users get the original child rendered untouched — no popover, no overhead.
 */
import { type ReactElement, useState, cloneElement } from "react";
import { useNavigate } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { trackGuestCTAClick } from "@/lib/guest-cta-analytics";

type SignUpToPostPromptProps = {
  /** The trigger element (typically a Button). Must support `onClick`. */
  children: ReactElement<{ onClick?: (e: React.MouseEvent) => void }>;
  /** Custom headline copy. */
  title?: string;
  /** Custom body copy under the headline. */
  description?: string;
  /** Where to send the visitor when they accept. */
  signUpHref?: string;
};

const SignUpToPostPrompt = ({
  children,
  title = "Sign up to post",
  description = "Posting to Flow needs a free account. Sign up to share your work, save what you love, and earn $RHOZE.",
  signUpHref = "/auth",
}: SignUpToPostPromptProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Authenticated → render the trigger as-is. No popover wrapping at all
  // so we don't intercept the original onClick or alter focus behavior.
  if (user) return children;

  // Wrap the existing trigger so its own click first opens our popover
  // instead of firing whatever onClick it had (which would try to open the
  // gated upload sheet/dialog).
  const wrappedTrigger = cloneElement(children, {
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setOpen(true);
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{wrappedTrigger}</PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-72 p-0"
        data-testid="flow-signup-to-post-prompt"
      >
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border/60 px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            className="text-xs"
          >
            Not now
          </Button>
          <Button
            size="sm"
            onClick={() => {
              trackGuestCTAClick("flow-signup-prompt", "popover");
              setOpen(false);
              navigate(signUpHref);
            }}
            className="text-xs"
          >
            Sign up free
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SignUpToPostPrompt;
