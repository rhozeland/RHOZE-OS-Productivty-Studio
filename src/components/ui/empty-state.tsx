import { ReactNode, isValidElement, createElement } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon | ReactNode;
  title: string;
  description?: string;
  cta?: {
    label: string;
    to?: string;
    onClick?: () => void;
    external?: boolean;
  };
  secondary?: {
    label: string;
    to?: string;
    onClick?: () => void;
  };
  className?: string;
  size?: "sm" | "md" | "lg";
  align?: "center" | "start";
}

/**
 * Actionable empty state. Always pair a clear one-liner with a CTA the user
 * can act on. Use `cta.to` for routes, `cta.onClick` for in-app actions.
 */
export function EmptyState({
  icon,
  title,
  description,
  cta,
  secondary,
  className,
  size = "md",
  align = "center",
}: EmptyStateProps) {
  const padding =
    size === "sm" ? "px-4 py-8" : size === "lg" ? "px-6 py-16" : "px-5 py-12";
  const iconBox =
    size === "sm" ? "h-10 w-10" : size === "lg" ? "h-14 w-14" : "h-12 w-12";
  const iconSize = size === "sm" ? 18 : size === "lg" ? 26 : 22;

  let iconNode: ReactNode = null;
  if (icon) {
    if (typeof icon === "function") {
      const Icon = icon as LucideIcon;
      iconNode = <Icon size={iconSize} className="text-muted-foreground" strokeWidth={1.6} />;
    } else {
      iconNode = icon;
    }
  }

  const ctaContent = cta && (
    <span className="inline-flex items-center gap-1.5">
      {cta.label}
      <ArrowRight className="h-3.5 w-3.5" />
    </span>
  );

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3 rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm",
        padding,
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {iconNode && (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full border border-border/40 bg-background/40",
            iconBox,
          )}
        >
          {iconNode}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground max-w-sm">{description}</p>
        )}
      </div>
      {(cta || secondary) && (
        <div className={cn("flex flex-wrap gap-2 pt-1", align === "center" ? "justify-center" : "")}>
          {cta &&
            (cta.to ? (
              cta.external ? (
                <Button asChild size="sm" variant="default">
                  <a href={cta.to} target="_blank" rel="noreferrer">
                    {ctaContent}
                  </a>
                </Button>
              ) : (
                <Button asChild size="sm" variant="default">
                  <Link to={cta.to}>{ctaContent}</Link>
                </Button>
              )
            ) : (
              <Button size="sm" variant="default" onClick={cta.onClick}>
                {ctaContent}
              </Button>
            ))}
          {secondary &&
            (secondary.to ? (
              <Button asChild size="sm" variant="ghost">
                <Link to={secondary.to}>{secondary.label}</Link>
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={secondary.onClick}>
                {secondary.label}
              </Button>
            ))}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
