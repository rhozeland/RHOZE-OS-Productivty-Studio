import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Plus,
  Heart,
  Send,
  MessageCircle,
  Expand,
  ArrowLeftRight,
  Music2,
  Camera,
  Video,
  PenLine,
  Palette,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { FlowScope } from "@/components/flow/FlowScopeToggle";
import FlowThumbnail from "@/components/flow/FlowThumbnail";
import AudioPreview from "@/components/marketplace/AudioPreview";
import { loadFlowFeed, type FlowItemWithProfile } from "@/lib/flow-feed";

const CATEGORIES = ["design", "music", "photo", "video", "writing"];

const AUDIO_EXT = /\.(mp3|wav|flac|aac|m4a|ogg|opus|aiff)(\?|$)/i;

const CAT_ICONS: Record<string, LucideIcon> = {
  music: Music2,
  audio: Music2,
  photo: Camera,
  video: Video,
  writing: PenLine,
  design: Palette,
};

const initials = (name?: string | null) =>
  (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const CompactFlowFeed = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const calibrationKey = user?.id ?? "guest";
  const [feedScope, setFeedScope] = useState<FlowScope>("all");
  const [preferredCategories, setPreferredCategories] = useState<string[]>(CATEGORIES);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(CATEGORIES);
  const [ready, setReady] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewModeHover, setPreviewModeHover] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const applyPrefs = (prefs: string[] | null, scope: FlowScope | null, hasSaved: boolean) => {
      if (cancelled) return;
      if (hasSaved) {
        const finalPrefs = prefs && prefs.length > 0 ? prefs : CATEGORIES;
        const finalScope = scope ?? "preferred";
        setPreferredCategories(finalPrefs);
        setFeedScope(finalScope);
        setSelectedCategories(finalScope === "all" ? CATEGORIES : finalPrefs);
      } else {
        setPreferredCategories(CATEGORIES);
        setFeedScope("all");
        setSelectedCategories(CATEGORIES);
      }
      setReady(true);
    };

    const cachedRaw = localStorage.getItem(`flow-calibrated-${calibrationKey}`);
    const cachedScope = localStorage.getItem(`flow-scope-${calibrationKey}`) as FlowScope | null;
    let cachedPrefs: string[] | null = null;
    if (cachedRaw) {
      try {
        cachedPrefs = JSON.parse(cachedRaw);
      } catch {
        cachedPrefs = null;
      }
    }
    applyPrefs(cachedPrefs, cachedScope, !!cachedRaw);

    if (user?.id) {
      void (async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("flow_feed_scope, flow_preferred_categories")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled || error) return;

        const dbScope = (data?.flow_feed_scope as FlowScope | null) ?? null;
        const dbPrefs = (data?.flow_preferred_categories as string[] | null) ?? null;
        const hasDbValue = dbScope !== null || (dbPrefs && dbPrefs.length > 0);
        if (hasDbValue) {
          applyPrefs(dbPrefs, dbScope, true);
          if (dbPrefs) localStorage.setItem(`flow-calibrated-${calibrationKey}`, JSON.stringify(dbPrefs));
          if (dbScope) localStorage.setItem(`flow-scope-${calibrationKey}`, dbScope);
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [calibrationKey, user?.id]);

  const { data: items = [], isFetching } = useQuery({
    queryKey: ["compact-flow-feed", feedScope, selectedCategories],
    queryFn: () => loadFlowFeed(supabase, selectedCategories),
    enabled: ready,
    staleTime: 60_000,
    retry: 1,
  });

  const topItems = useMemo(() => items.slice(0, 8), [items]);
  useEffect(() => {
    if (topItems.length <= 1) {
      setPreviewIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setPreviewIndex((current) => (current + 1) % topItems.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [topItems]);

  const activeItem = topItems[previewIndex % Math.max(topItems.length, 1)] as FlowItemWithProfile | undefined;

  const openFlow = (itemId?: string, mode: "swipe" | "browse" = "swipe") => {
    const query = new URLSearchParams();
    if (itemId) query.set("item", itemId);
    if (mode === "browse") query.set("view", "browse");
    navigate(query.toString() ? `/flow?${query.toString()}` : "/flow", {
      state: { from: `${location.pathname}${location.search}${location.hash}` },
    });
  };

  const activeCategory = (activeItem?.category ?? "").toLowerCase();
  const CatIcon = CAT_ICONS[activeCategory] ?? Sparkles;
  const isAudioFile = !!activeItem?.file_url && AUDIO_EXT.test(activeItem.file_url);
  const isMusic = activeCategory === "music" || activeCategory === "audio" || isAudioFile;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-2.5 sm:p-3">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(circle at 15% 20%, hsl(var(--pink) / 0.28), transparent 36%)," +
            "radial-gradient(circle at 70% 14%, hsl(var(--warm) / 0.16), transparent 30%)," +
            "linear-gradient(135deg, hsl(var(--pink) / 0.18), hsl(var(--background)) 52%, hsl(var(--pink) / 0.10))",
        }}
      />

      <div className="relative space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => openFlow(activeItem?.id)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border/50 bg-card/85 px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-card"
            >
              <Expand className="h-3.5 w-3.5" />
              Expand
            </button>
            <button
              type="button"
              onMouseEnter={() => setPreviewModeHover(true)}
              onMouseLeave={() => setPreviewModeHover(false)}
              onFocus={() => setPreviewModeHover(true)}
              onBlur={() => setPreviewModeHover(false)}
              onClick={() => openFlow(undefined, previewModeHover ? "browse" : "swipe")}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border/50 bg-card/85 px-3 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-card hover:text-foreground"
              aria-label={previewModeHover ? "Browse all posts" : "Auto-previewing posts"}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              {previewModeHover ? "Browse all" : "Auto-previewing"}
            </button>
          </div>

          {user && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full border-border/50 bg-card/85 shadow-sm"
              onClick={() => navigate("/flow?share=1", { state: { from: `${location.pathname}${location.search}${location.hash}` } })}
              aria-label="Post to Flow"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        <motion.button
          type="button"
          onClick={() => openFlow(activeItem?.id)}
          animate={{ y: [0, -2, 0] }}
          whileHover={{ y: -3 }}
          transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut" }}
          className="group relative w-full overflow-hidden rounded-2xl border border-border/60 bg-card/95 p-2 text-left shadow-[0_14px_40px_-26px_hsl(var(--foreground)/0.28)]"
        >
          <div className="relative mx-auto w-full overflow-hidden rounded-xl border border-border/40 aspect-[16/10] sm:aspect-[16/9]">
            {activeItem ? (
              <FlowThumbnail
                fileUrl={activeItem.file_url}
                linkUrl={activeItem.link_url}
                title={activeItem.title ?? "Untitled"}
                description={activeItem.description as string | null}
                category={activeItem.category as string | null}
                className="absolute inset-0 h-full w-full object-cover p-0"
                hideCaption
              />
            ) : (
              <div className="absolute inset-0 animate-pulse bg-muted" />
            )}

            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card via-card/80 to-transparent" />

            {/* Top-left: category icon chip */}
            {activeItem?.category && (
              <span
                className="absolute left-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-card/85 text-foreground shadow-sm backdrop-blur-sm"
                aria-label={activeCategory}
              >
                <CatIcon className="h-3.5 w-3.5" />
              </span>
            )}

            {/* Inline audio for music drops — tapping play expands to full Flow
                instead of starting playback in the mini widget, so audio always
                plays in context with the creator card + actions. */}
            {isMusic && isAudioFile && activeItem?.file_url && (
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  openFlow(activeItem.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    openFlow(activeItem.id);
                  }
                }}
                className="absolute left-2 right-2 bottom-2 z-10 rounded-xl border border-border/60 bg-card/90 backdrop-blur-sm shadow-sm cursor-pointer"
                aria-label="Open in Flow to play"
              >
                {/* Pointer events disabled so the AudioPreview's own play button
                    can't capture the click — the wrapper always wins and
                    expands into Flow. */}
                <div className="pointer-events-none">
                  <AudioPreview src={activeItem.file_url} compact />
                </div>
              </div>
            )}

            {/* Bottom: creator + title (hidden when inline audio is shown) */}
            {!(isMusic && isAudioFile) && (
              <div className="absolute inset-x-0 bottom-0 p-2.5">
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7 border border-border/50 bg-card/90">
                    <AvatarImage src={activeItem?.profiles?.avatar_url ?? undefined} alt={activeItem?.profiles?.display_name ?? "Creator"} />
                    <AvatarFallback className="text-[10px] font-semibold text-foreground">
                      {initials(activeItem?.profiles?.display_name ?? null)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-muted-foreground truncate">
                      {activeItem?.profiles?.display_name ?? activeItem?.profiles?.username ?? "Creator"}
                    </p>
                    <h3 className="font-display text-sm sm:text-base leading-tight text-foreground line-clamp-1">
                      {activeItem?.title ?? (isFetching ? "Loading…" : "No flow items yet")}
                    </h3>
                  </div>
                  <div className="hidden sm:flex items-center gap-1">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-card/85 text-foreground">
                      <Heart className="h-3.5 w-3.5" />
                    </span>
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-card/85 text-foreground">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </span>
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-card/85 text-foreground">
                      <Send className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.button>
      </div>
    </section>
  );
};

export default CompactFlowFeed;
