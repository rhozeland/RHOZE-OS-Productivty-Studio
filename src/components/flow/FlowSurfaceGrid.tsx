/**
 * FlowSurfaceGrid — renders non-creator-works surfaces (Creators, Listings,
 * Events, Spaces) inside Flow Mode as a swipeable, full-bleed card deck that
 * matches the "All" Flow card aesthetic: stacked cards, big cover image,
 * gradient overlay, bottom-anchored title block, drag-to-advance.
 *
 * Keeps users on /flow without navigating away. Uses the same data hooks
 * as the Connect room so we stay in sync.
 */
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import {
  Loader2,
  Users,
  ListPlus,
  CalendarDays,
  Building2,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  useHireRows,
  useCallRows,
  useEventRows,
  useSpaceRows,
  type ConnectRow,
} from "@/components/connect/useConnectRows";

export type FlowSurface = "creators" | "listings" | "events" | "spaces";

const META: Record<FlowSurface, { label: string; Icon: any; empty: string }> = {
  creators: { label: "Creators", Icon: Users, empty: "No creators to surface yet." },
  listings: { label: "Listings", Icon: ListPlus, empty: "No active listings right now." },
  events: { label: "Events", Icon: CalendarDays, empty: "No upcoming events scheduled." },
  spaces: { label: "Spaces", Icon: Building2, empty: "No spaces available right now." },
};

interface Props {
  surface: FlowSurface;
}

export default function FlowSurfaceGrid({ surface }: Props) {
  const navigate = useNavigate();
  const creators = useHireRows(surface === "creators");
  const listings = useCallRows(surface === "listings");
  const events = useEventRows(surface === "events");
  const spaces = useSpaceRows(surface === "spaces");

  const active =
    surface === "creators"
      ? creators
      : surface === "listings"
        ? listings
        : surface === "events"
          ? events
          : spaces;

  const rows: ConnectRow[] = useMemo(
    () => (active.data ?? []) as ConnectRow[],
    [active.data],
  );
  const meta = META[surface];

  const [index, setIndex] = useState(0);
  // Reset position whenever surface (or data length) changes so we never
  // land on a stale out-of-range card after a filter flip.
  useEffect(() => {
    setIndex(0);
  }, [surface, rows.length]);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-8, 8]);
  const opacity = useTransform(x, [-220, 0, 220], [0.5, 1, 0.5]);

  const total = rows.length;
  const current = total > 0 ? rows[index % total] : null;
  const next = total > 1 ? rows[(index + 1) % total] : null;
  const peek = total > 2 ? rows[(index + 2) % total] : null;

  const advance = (dir: 1 | -1) => {
    if (total === 0) return;
    setIndex((i) => (i + dir + total) % total);
    x.set(0);
  };

  const onDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -100 || info.velocity.x < -500) advance(1);
    else if (info.offset.x > 100 || info.velocity.x > 500) advance(-1);
    else x.set(0);
  };

  if (active.isLoading) {
    return (
      <div className="flex h-full items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (total === 0 || !current) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-24">
        <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border/60 bg-card/40 backdrop-blur-sm px-6 py-12 text-center">
          <meta.Icon className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 font-display text-sm font-semibold text-foreground">
            {meta.empty}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try another filter — Flow is always fresh.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex h-full w-full max-w-[440px] flex-col items-center justify-center px-4 py-6">
      {/* Card stack */}
      <div className="relative h-[68vh] w-full max-h-[640px]">
        {/* Peek card (3rd) */}
        {peek && (
          <SurfaceCard
            row={peek}
            meta={meta}
            className="absolute inset-0 scale-[0.92] translate-y-6 opacity-50"
            interactive={false}
          />
        )}
        {/* Next card (2nd) */}
        {next && (
          <SurfaceCard
            row={next}
            meta={meta}
            className="absolute inset-0 scale-[0.96] translate-y-3 opacity-80"
            interactive={false}
          />
        )}
        {/* Top card — draggable */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={`${current.kind}-${current.id}-${index}`}
            className="absolute inset-0 touch-pan-y"
            style={{ x, rotate, opacity }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={onDragEnd}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ x: 0, opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
          >
            <SurfaceCard row={current} meta={meta} onOpen={() => navigate(current.detailHref)} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="mt-5 flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-full backdrop-blur-sm"
          onClick={() => advance(-1)}
          aria-label="Previous"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          size="sm"
          className="h-11 rounded-full px-5"
          onClick={() => navigate(current.detailHref)}
        >
          Open <ArrowUpRight className="ml-1.5 h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-full backdrop-blur-sm"
          onClick={() => advance(1)}
          aria-label="Next"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        {index + 1} / {total} · swipe to browse
      </p>
    </div>
  );
}

function SurfaceCard({
  row,
  meta,
  className,
  interactive = true,
  onOpen,
}: {
  row: ConnectRow;
  meta: { label: string; Icon: any; empty: string };
  className?: string;
  interactive?: boolean;
  onOpen?: () => void;
}) {
  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-3xl border border-border/40 bg-card shadow-[0_30px_80px_-30px_hsl(var(--foreground)/0.35)]",
        className,
      )}
      onClick={interactive ? onOpen : undefined}
      role={interactive ? "button" : undefined}
    >
      {/* Cover */}
      <div className="absolute inset-0">
        {row.coverUrl ? (
          <img
            src={row.coverUrl}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground/40">
            <meta.Icon className="h-16 w-16" />
          </div>
        )}
      </div>

      {/* Top gradient + chip */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background/70 via-background/20 to-transparent" />
      <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/70 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-foreground backdrop-blur-md">
        <meta.Icon className="h-3 w-3" />
        {meta.label}
      </div>

      {/* Bottom gradient + content */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background via-background/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 space-y-2 p-5">
        {(row.priceLabel || row.metaLabel) && (
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {row.priceLabel || row.metaLabel}
          </p>
        )}
        <h3 className="font-display text-2xl font-semibold leading-tight text-foreground line-clamp-2">
          {row.title}
        </h3>
        {row.subtitle && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {row.subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
