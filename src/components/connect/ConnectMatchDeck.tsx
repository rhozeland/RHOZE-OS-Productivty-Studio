/**
 * ConnectMatchDeck — inline swipeable card stack on the Connect page.
 *
 * Sits under the search bar. Shows 1 active card with 2 behind it for depth.
 * Drag right = save (just dismiss for now), left = pass, click "Expand" → /connect/match
 * for the fullscreen Tinder/Flow-style match mode.
 *
 * Mixes all kinds (hire/space/call/event) — algorithmic matchmaking surface.
 */
import { useMemo, useState } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Expand, ArrowRight, ArrowLeft, MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMixedConnectRows, KIND_META, type ConnectRow } from "./useConnectRows";
import { avatarGradientFor } from "@/lib/avatar-gradient";
import { todayGradient } from "@/lib/rhoze-gradients";

const SWIPE_THRESHOLD = 90;

const ConnectMatchDeck = () => {
  const { rows, isLoading } = useMixedConnectRows(true);
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();
  const grad = useMemo(() => todayGradient(), []);

  const stack = useMemo(() => rows.slice(cursor, cursor + 3), [rows, cursor]);
  const current = stack[0];

  const advance = () => setCursor((c) => Math.min(c + 1, rows.length));

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > SWIPE_THRESHOLD) advance();
  };

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-border bg-card/60 h-48 animate-pulse" />
    );
  }
  if (!rows.length) return null;

  return (
    <div
      className="relative rounded-3xl border border-border/70 bg-card/60 backdrop-blur p-4 overflow-hidden"
      data-rhoze-gradient={grad.id}
    >
      {/* Halo glow */}
      <div
        aria-hidden
        className="absolute -inset-10 opacity-40 blur-3xl pointer-events-none"
        style={{ background: grad.halo }}
      />

      {/* Header */}
      <div className="relative flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-sm"
            style={{ backgroundImage: grad.text }}
          >
            <Sparkles className="h-3 w-3" /> Match
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Swipe to find collaborators · {cursor + 1}/{rows.length}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full hidden"
          onClick={() => navigate("/connect/match")}
        >
          <Expand className="h-3.5 w-3.5 mr-1.5" /> Expand
        </Button>
      </div>

      {/* Card stack */}
      <div className="relative h-[230px] sm:h-[210px]">
        <AnimatePresence initial={false}>
          {stack
            .slice()
            .reverse()
            .map((row, idx) => {
              const depth = stack.length - 1 - idx; // 0 = top
              const isTop = depth === 0;
              return (
                <motion.div
                  key={row.id}
                  className="absolute inset-0"
                  initial={{
                    scale: 1 - depth * 0.04,
                    y: depth * 8,
                    opacity: 1,
                  }}
                  animate={{
                    scale: 1 - depth * 0.04,
                    y: depth * 8,
                    opacity: 1 - depth * 0.18,
                  }}
                  exit={{ x: 400, opacity: 0, rotate: 12, transition: { duration: 0.25 } }}
                  drag={isTop ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.7}
                  onDragEnd={isTop ? onDragEnd : undefined}
                  style={{ zIndex: 10 - depth }}
                >
                  <DeckCard row={row} interactive={isTop} />
                </motion.div>
              );
            })}
        </AnimatePresence>

        {!current && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            You've reviewed every match. Check back tomorrow ✨
          </div>
        )}
      </div>

      {/* Controls */}
      {current && (
        <div className="relative mt-3 flex items-center justify-center gap-2">
          <Button size="sm" variant="ghost" className="rounded-full" onClick={advance}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Pass
          </Button>
          {current.ownerId && (
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full"
              onClick={() => navigate(`/messages?to=${current.ownerId}`)}
            >
              <MessageSquare className="h-4 w-4 mr-1" /> Message
            </Button>
          )}
          <Button
            size="sm"
            className="rounded-full"
            onClick={() => {
              navigate(current.detailHref);
            }}
          >
            Open <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
};

const DeckCard = ({ row, interactive }: { row: ConnectRow; interactive: boolean }) => {
  const meta = KIND_META[row.kind];
  const Icon = meta.Icon;
  const grad = avatarGradientFor(row.ownerId || row.id);
  return (
    <div
      className={cn(
        "h-full w-full rounded-2xl border border-border bg-background shadow-lg overflow-hidden flex",
        interactive ? "cursor-grab active:cursor-grabbing" : "pointer-events-none",
      )}
    >
      {/* Visual */}
      <div
        className="relative w-1/3 shrink-0"
        style={{
          background: row.coverUrl ? undefined : grad.background,
        }}
      >
        {row.coverUrl ? (
          <img src={row.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Icon className="h-10 w-10 text-foreground/40" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-background/90 backdrop-blur px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-foreground">
            <Icon className="h-2.5 w-2.5" />
            {meta.label.replace(/s$/, "")}
          </span>
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0 p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          {row.ownerId && (
            <Link
              to={`/profiles/${row.ownerId}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-xs hover:underline"
            >
              <div
                className="h-6 w-6 rounded-full overflow-hidden ring-1 ring-border"
                style={{ background: grad.background }}
              >
                {row.ownerAvatar && (
                  <img src={row.ownerAvatar} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <span className="font-medium text-foreground truncate">
                {row.ownerName || "Creator"}
              </span>
            </Link>
          )}
        </div>
        <h3 className="font-display text-lg font-bold text-foreground leading-tight line-clamp-2">
          {row.title}
        </h3>
        {row.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-3 flex-1">
            {row.description}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {row.priceLabel && (
            <span className="font-semibold text-foreground tabular-nums">{row.priceLabel}</span>
          )}
          {row.metaLabel && <span>{row.metaLabel}</span>}
          {row.category && <span className="capitalize">· {row.category}</span>}
        </div>
      </div>
    </div>
  );
};

export default ConnectMatchDeck;
