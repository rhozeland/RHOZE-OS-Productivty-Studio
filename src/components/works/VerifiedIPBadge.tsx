/**
 * VerifiedIPBadge — ambient "this is anchored creative IP" mark.
 *
 * Shown anywhere a creation surfaces (profile, project, hub post, offering,
 * studio booking) when it has a Solana anchor signature. Click → opens the
 * Solana explorer in a new tab so anyone can independently verify the proof.
 *
 * Why a shared component:
 *   The Works pivot turns IP into a thread woven through the whole app
 *   instead of a siloed tab. Every surface that displays a creation should
 *   reach for THIS badge — never re-implement the visual.
 *
 * Sizes:
 *   - "xs"  → inline next to a title (12px icon, no label on mobile)
 *   - "sm"  → card chip (default)
 *   - "md"  → hero / detail page
 */
import { Shield, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  signature?: string | null;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

const VerifiedIPBadge = ({
  signature,
  size = "sm",
  showLabel = true,
  className,
}: Props) => {
  if (!signature) return null;

  const explorerUrl = `https://explorer.solana.com/tx/${signature}`;

  const sizing =
    size === "xs"
      ? "h-5 px-1.5 text-[10px] gap-1 [&_svg]:h-3 [&_svg]:w-3"
      : size === "md"
      ? "h-7 px-2.5 text-xs gap-1.5 [&_svg]:h-3.5 [&_svg]:w-3.5"
      : "h-6 px-2 text-[11px] gap-1.5 [&_svg]:h-3 [&_svg]:w-3";

  return (
    <a
      href={explorerUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Anchored on Solana · ${signature.slice(0, 12)}…`}
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        "border border-emerald-500/20 hover:border-emerald-500/40",
        "transition-colors",
        sizing,
        className,
      )}
    >
      <Shield />
      {showLabel && (
        <>
          <span className={size === "xs" ? "hidden sm:inline" : ""}>
            Verified IP
          </span>
          {size !== "xs" && <ExternalLink className="opacity-60" />}
        </>
      )}
    </a>
  );
};

export default VerifiedIPBadge;
