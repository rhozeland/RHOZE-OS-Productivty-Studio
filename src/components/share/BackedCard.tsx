/**
 * BackedCard — 1080×1080 share card rendered as a DOM node so we can
 * snapshot it with html-to-image. Always renders at full size; callers
 * scale it via CSS `transform` for previews and snapshot at native res
 * for downloads.
 *
 * Uses brand wordmark + today's Rhozeland gradient so every card feels
 * on-brand without any new tokens.
 */
import { forwardRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import rhozelandLogo from "@/assets/rhozeland-logo.png";
import { todayGradient } from "@/lib/rhoze-gradients";
import { formatLocation, type BackedCardData } from "./useBackedCardData";

export type BackedCardVariant =
  | { kind: "concierge"; projectTitle: string }
  | { kind: "milestone"; label: string }
  | { kind: "default" };

interface Props {
  data: BackedCardData;
  variant?: BackedCardVariant;
}

const fmtCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const BackedCard = forwardRef<HTMLDivElement, Props>(
  ({ data, variant = { kind: "default" } }, ref) => {
    const grad = todayGradient();
    const category = formatLocation(
      data.archetype,
      data.regionCode,
      data.roles,
    );

    return (
      <div
        ref={ref}
        // Native 1080×1080 — html-to-image captures at this size.
        style={{ width: 1080, height: 1080, background: grad.surface }}
        className="relative overflow-hidden font-body text-foreground"
      >
        {/* Aurora wash overlay */}
        <div
          aria-hidden
          style={{ background: grad.halo }}
          className="absolute inset-0 opacity-90 pointer-events-none"
        />

        {/* ── Top bar ── */}
        <div className="absolute top-12 left-12 right-12 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <img
              src={rhozelandLogo}
              alt=""
              className="h-14 w-14 object-contain"
              crossOrigin="anonymous"
            />
            <span className="text-3xl font-bold tracking-tight">
              Rhozeland
            </span>
          </div>
          <span className="text-sm font-bold uppercase tracking-[0.24em] text-foreground/80">
            Backed by Rhozeland
          </span>
        </div>

        {/* ── Middle: avatar + name + category ── */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-16 text-center z-10">
          <Avatar className="h-56 w-56 ring-4 ring-foreground/10 shadow-2xl mb-10">
            {data.avatarUrl ? (
              <AvatarImage
                src={data.avatarUrl}
                alt={data.displayName}
                crossOrigin="anonymous"
              />
            ) : null}
            <AvatarFallback className="text-6xl font-bold">
              {initials(data.displayName)}
            </AvatarFallback>
          </Avatar>

          <h1
            className="font-display text-7xl font-black tracking-tight leading-[1.05] max-w-[900px]"
            style={{
              backgroundImage: grad.text,
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            {data.displayName}
          </h1>
          <p className="mt-4 text-2xl font-medium text-foreground/70">
            {category}
          </p>

          {/* Stats row */}
          <div className="mt-12 grid grid-cols-3 gap-6 w-full max-w-[820px]">
            {[
              { label: "Backers", value: fmtCount(data.backers) },
              { label: "$RHOZE earned", value: fmtCount(data.rhozeEarned) },
              {
                label: "Projects completed",
                value: fmtCount(data.projectsCompleted),
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-3xl border border-foreground/10 bg-background/60 backdrop-blur px-6 py-7 text-center"
              >
                <p className="font-display text-5xl font-black tabular-nums">
                  {s.value}
                </p>
                <p className="mt-2 text-[13px] uppercase tracking-[0.18em] text-muted-foreground font-bold">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom band: variant badge + tagline + URL ── */}
        <div className="absolute bottom-12 left-12 right-12 flex items-end justify-between z-10">
          <div className="max-w-[760px] space-y-3">
            {variant.kind === "concierge" && (
              <>
                <span className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em]">
                  Concierge project
                </span>
                <p className="font-display text-3xl font-bold text-foreground leading-tight">
                  {variant.projectTitle}
                </p>
              </>
            )}
            {variant.kind === "milestone" && (
              <>
                <span className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em]">
                  {variant.label}
                </span>
                <p className="font-display text-3xl font-bold text-foreground leading-tight">
                  Back them before everyone else does.
                </p>
              </>
            )}
            {variant.kind === "default" && (
              <p className="font-display text-3xl font-bold text-foreground leading-tight">
                Back them before everyone else does.
              </p>
            )}
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground/70 shrink-0">
            rhozeland.app
          </span>
        </div>
      </div>
    );
  },
);

BackedCard.displayName = "BackedCard";
export default BackedCard;
