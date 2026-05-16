/**
 * ConnectMatchPage — fullscreen matchmaking surface (/connect/match).
 *
 * Tinder-style vertical card with horizontal swipe gestures + keyboard
 * shortcuts. Mixes all Connect kinds (creators, spaces, open calls, events)
 * into one algorithmic deck. Right = open detail, Left = pass, Down = message.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { X, ArrowRight, MessageSquare, ChevronLeft, Sparkles, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMixedConnectRows, KIND_META, type ConnectRow } from "@/components/connect/useConnectRows";
import { avatarGradientFor } from "@/lib/avatar-gradient";
import { todayGradient } from "@/lib/rhoze-gradients";

const SWIPE_THRESHOLD = 120;

const ConnectMatchPage = () => {
  const { rows, isLoading } = useMixedConnectRows(true);
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();
  const grad = useMemo(() => todayGradient(), []);

  const current = rows[cursor];
  const next = rows[cursor + 1];

  const advance = () => setCursor((c) => Math.min(c + 1, rows.length));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") advance();
      if (e.key === "ArrowRight" && current) navigate(current.detailHref);
      if (e.key === "Escape") navigate(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, navigate]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD) advance();
    else if (info.offset.x > SWIPE_THRESHOLD && current) navigate(current.detailHref);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background overflow-hidden flex flex-col"
      data-rhoze-gradient={grad.id}
    >
      {/* Background wash */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{ background: grad.surface }}
      />
      <div
        aria-hidden
        className="absolute inset-0 backdrop-blur-3xl"
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-4">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-white shadow"
            style={{ backgroundImage: grad.text }}
          >
            <Sparkles className="h-3 w-3" /> Match Mode
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {Math.min(cursor + 1, rows.length)} / {rows.length}
          </span>
        </div>
        <div className="w-16" />
      </header>

      {/* Card area */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 pb-6">
        {isLoading ? (
          <div className="w-full max-w-md h-[60vh] rounded-3xl bg-card/60 animate-pulse" />
        ) : !current ? (
          <div className="text-center max-w-sm">
            <h2 className="font-display text-2xl font-bold mb-2">You're all caught up</h2>
            <p className="text-sm text-muted-foreground mb-6">
              You've reviewed every collaborator, space, call, and event we have for you today.
              New matches drop daily.
            </p>
            <Button onClick={() => navigate("/market")} className="rounded-full">
              Back to Connect
            </Button>
          </div>
        ) : (
          <div className="relative w-full max-w-md h-[min(70vh,640px)]">
            {next && (
              <div
                className="absolute inset-0 scale-[0.96] translate-y-3 opacity-60 pointer-events-none"
                style={{ zIndex: 1 }}
              >
                <MatchCard row={next} />
              </div>
            )}
            <AnimatePresence initial={false}>
              <motion.div
                key={current.id}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.6}
                onDragEnd={onDragEnd}
                initial={{ scale: 0.96, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ x: -400, opacity: 0, rotate: -10, transition: { duration: 0.3 } }}
                whileDrag={{ rotate: 0 }}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                style={{ zIndex: 2 }}
              >
                <MatchCard row={current} />
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Controls */}
      {current && (
        <footer className="relative z-10 pb-6 sm:pb-8 flex items-center justify-center gap-4">
          <button
            onClick={advance}
            className="h-14 w-14 rounded-full border-2 border-border bg-background hover:scale-105 active:scale-95 transition-transform flex items-center justify-center shadow"
            aria-label="Pass"
          >
            <X className="h-6 w-6 text-foreground/70" />
          </button>
          {current.ownerId && (
            <button
              onClick={() => navigate(`/messages?to=${current.ownerId}`)}
              className="h-12 w-12 rounded-full border-2 border-border bg-background hover:scale-105 active:scale-95 transition-transform flex items-center justify-center shadow"
              aria-label="Message"
            >
              <MessageSquare className="h-5 w-5 text-foreground/70" />
            </button>
          )}
          <button
            onClick={() => navigate(current.detailHref)}
            className="h-14 w-14 rounded-full text-white hover:scale-105 active:scale-95 transition-transform flex items-center justify-center shadow-lg"
            style={{ backgroundImage: grad.text }}
            aria-label="Open"
          >
            <Heart className="h-6 w-6 fill-current" />
          </button>
        </footer>
      )}
    </div>
  );
};

const MatchCard = ({ row }: { row: ConnectRow }) => {
  const meta = KIND_META[row.kind];
  const Icon = meta.Icon;
  const grad = avatarGradientFor(row.ownerId || row.id);
  return (
    <div className="h-full w-full rounded-3xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col">
      {/* Cover */}
      <div
        className="relative h-2/5 shrink-0"
        style={{ background: row.coverUrl ? undefined : grad.background }}
      >
        {row.coverUrl ? (
          <img src={row.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Icon className="h-16 w-16 text-foreground/30" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">
            <Icon className="h-3 w-3" />
            {meta.label.replace(/s$/, "")}
          </span>
        </div>
        {row.priceLabel && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center rounded-full bg-foreground text-background px-3 py-1 text-xs font-bold tabular-nums">
              {row.priceLabel}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 p-5 sm:p-6 overflow-y-auto flex flex-col">
        {row.ownerId && (
          <Link
            to={`/profiles/${row.ownerId}`}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "flex items-center gap-2 mb-3 text-sm hover:underline self-start",
            )}
          >
            <div
              className="h-8 w-8 rounded-full overflow-hidden ring-1 ring-border"
              style={{ background: grad.background }}
            >
              {row.ownerAvatar && (
                <img src={row.ownerAvatar} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <span className="font-medium text-foreground">{row.ownerName || "Creator"}</span>
          </Link>
        )}
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground leading-tight">
          {row.title}
        </h2>
        {row.subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{row.subtitle}</p>
        )}
        {row.description && (
          <p className="mt-4 text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap line-clamp-[10]">
            {row.description}
          </p>
        )}
        <div className="mt-auto pt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {row.metaLabel && <span>{row.metaLabel}</span>}
          {row.category && <span className="capitalize">· {row.category}</span>}
        </div>
      </div>

      {/* Swipe hint */}
      <div className="px-5 py-2 border-t border-border/60 text-[10px] uppercase tracking-[0.18em] text-muted-foreground flex items-center justify-between">
        <span>← Pass</span>
        <span>Open →</span>
      </div>
    </div>
  );
};

export default ConnectMatchPage;
