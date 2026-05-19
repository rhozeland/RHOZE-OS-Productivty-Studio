import { Badge } from "@/components/ui/badge";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  size?: "sm" | "md";
}

export function VerifiedProBadge({ className, size = "sm" }: Props) {
  return (
    <Badge
      className={cn(
        "gap-1 border-0 text-white bg-gradient-to-r from-amber-500 via-fuchsia-500 to-indigo-500",
        size === "sm" ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-xs",
        className,
      )}
    >
      <BadgeCheck className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      Pro
    </Badge>
  );
}

export default VerifiedProBadge;
