/**
 * VerifiedArtistBadge — identity-tier mark for the human/profile.
 *
 * Distinct from <VerifiedIPBadge /> (which marks anchored creative IP).
 * This badge says: "Rhozeland has manually verified this is the real artist."
 * It gates monetization (coin launch, paid services, paid Spaces) and protects
 * fans from impersonation.
 *
 * Sizes mirror VerifiedIPBadge so the two can sit side-by-side cleanly.
 */
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  status?: "none" | "pending" | "verified" | "revoked" | null;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

const VerifiedArtistBadge = ({
  status,
  size = "sm",
  showLabel = true,
  className,
}: Props) => {
  if (status !== "verified") return null;

  const sizing =
    size === "xs"
      ? "h-5 px-1.5 text-[10px] gap-1 [&_svg]:h-3 [&_svg]:w-3"
      : size === "md"
      ? "h-7 px-2.5 text-xs gap-1.5 [&_svg]:h-3.5 [&_svg]:w-3.5"
      : "h-6 px-2 text-[11px] gap-1.5 [&_svg]:h-3 [&_svg]:w-3";

  return (
    <span
      title="Verified Artist · identity confirmed by Rhozeland"
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        "bg-sky-500/10 text-sky-600 dark:text-sky-400",
        "border border-sky-500/20",
        sizing,
        className,
      )}
    >
      <BadgeCheck />
      {showLabel && (
        <span className={size === "xs" ? "hidden sm:inline" : ""}>
          Verified Artist
        </span>
      )}
    </span>
  );
};

export default VerifiedArtistBadge;
