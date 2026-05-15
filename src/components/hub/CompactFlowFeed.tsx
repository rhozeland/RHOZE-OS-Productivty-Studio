import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, Heart, Send, ShieldCheck, MessageCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FlowScopeToggle, type FlowScope } from "@/components/flow/FlowScopeToggle";
import FlowThumbnail from "@/components/flow/FlowThumbnail";
import { loadFlowFeed, type FlowItemWithProfile } from "@/lib/flow-feed";
import { cn } from "@/lib/utils";

const CATEGORIES = ["design", "music", "photo", "video", "writing"];

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

  const setScope = (scope: FlowScope) => {
    if (scope === feedScope) return;
    setFeedScope(scope);
    const nextSelected = scope === "all" ? CATEGORIES : preferredCategories.length > 0 ? preferredCategories : CATEGORIES;
    setSelectedCategories(nextSelected);
    localStorage.setItem(`flow-scope-${calibrationKey}`, scope);
  };

  const { data: items = [], isFetching } = useQuery({
    queryKey: ["compact-flow-feed", feedScope, selectedCategories],
    queryFn: () => loadFlowFeed(supabase, selectedCategories),
    enabled: ready,
    staleTime: 60_000,
    retry: 1,
  });

  const topItems = useMemo(() => items.slice(0, 8), [items]);
  const activeItem = topItems[0] as FlowItemWithProfile | undefined;
  const sideItems = topItems.slice(1, 4);

  const openFlow = (itemId?: string) => {
    navigate(itemId ? `/flow?item=${itemId}` : "/flow", {
      state: { from: `${location.pathname}${location.search}${location.hash}` },
    });
  };

  return (
    <section className="relative overflow-hidden rounded-[1.5rem] border border-border/70 bg-card/80 p-3 sm:p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(circle at 15% 20%, hsl(var(--pink) / 0.32), transparent 34%)," +
            "radial-gradient(circle at 65% 12%, hsl(var(--warm) / 0.18), transparent 28%)," +
            "linear-gradient(135deg, hsl(var(--pink) / 0.22), hsl(var(--background)) 48%, hsl(var(--pink) / 0.12))",
        }}
      />

      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-0.5 rounded-full border border-border/50 bg-card/85 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => openFlow(activeItem?.id)}
                className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                Swipe
              </button>
              <button
                type="button"
                onClick={() => openFlow()}
                className="rounded-full px-4 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Browse
              </button>
            </div>

            <FlowScopeToggle
              scope={feedScope}
              onScopeChange={setScope}
              visible={preferredCategories.length > 0 && preferredCategories.length < CATEGORIES.length}
              className="!hidden min-[520px]:!flex bg-card/85 border-border/50 shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {user && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-border/50 bg-card/85 shadow-sm"
                onClick={() => navigate("/flow?share=1", { state: { from: `${location.pathname}${location.search}${location.hash}` } })}
                aria-label="Post to Flow"
              >
                <Plus className="h-4.5 w-4.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="min-[520px]:hidden">
          <FlowScopeToggle
            scope={feedScope}
            onScopeChange={setScope}
            visible={preferredCategories.length > 0 && preferredCategories.length < CATEGORIES.length}
            className="!flex w-fit bg-card/85 border-border/50 shadow-sm"
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px] xl:grid-cols-[minmax(0,1fr)_240px]">
          <motion.button
            type="button"
            onClick={() => openFlow(activeItem?.id)}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="group relative overflow-hidden rounded-[1.5rem] border border-border/60 bg-card text-left shadow-[0_20px_60px_-30px_hsl(var(--foreground)/0.28)]"
          >
            <div className="relative aspect-[7/8] sm:aspect-[9/10] lg:aspect-[7/8] overflow-hidden">
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

              <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-card via-card/82 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4">
                <div className="flex flex-wrap items-center gap-2 pb-2.5">
                  {activeItem?.category && (
                    <span className="rounded-full bg-warm/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-warm-foreground">
                      {activeItem.category}
                    </span>
                  )}
                  <span className="rounded-full border border-border/60 bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                    Fingerprinted
                  </span>
                  <span className="rounded-full border border-emerald-500/30 bg-card/80 px-3 py-1 text-xs font-medium text-emerald-600 backdrop-blur-sm dark:text-emerald-400">
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Verify
                    </span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openFlow(activeItem?.id); }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/85 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-card"
                  >
                    <Heart className="h-3.5 w-3.5" /> Like
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openFlow(activeItem?.id); }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/85 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-card"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Comment
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openFlow(activeItem?.id); }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/85 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-card"
                  >
                    <Send className="h-3.5 w-3.5" /> Send
                  </button>
                </div>

                <div className="mt-3.5 flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-border/50 bg-card/90">
                    <AvatarImage src={activeItem?.profiles?.avatar_url ?? undefined} alt={activeItem?.profiles?.display_name ?? "Creator"} />
                    <AvatarFallback className="text-xs font-semibold text-foreground">
                      {initials(activeItem?.profiles?.display_name ?? null)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {activeItem?.profiles?.display_name ?? activeItem?.profiles?.username ?? "Creator"}
                    </p>
                    <h3 className="font-display text-xl sm:text-[1.7rem] leading-[1.04] text-foreground line-clamp-2">
                      {activeItem?.title ?? (isFetching ? "Loading…" : "No flow items yet")}
                    </h3>
                  </div>
                </div>
              </div>
            </div>
          </motion.button>

          <div className="hidden lg:flex flex-col gap-3">
            {sideItems.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openFlow(item.id)}
                className={cn(
                  "group relative overflow-hidden rounded-[1.25rem] border border-border/55 bg-card text-left shadow-[0_18px_45px_-30px_hsl(var(--foreground)/0.3)] transition-transform hover:-translate-y-0.5",
                  index === 0 ? "h-[190px]" : "h-[142px]",
                )}
              >
                <FlowThumbnail
                  fileUrl={item.file_url}
                  linkUrl={item.link_url}
                  title={item.title ?? "Untitled"}
                  description={item.description as string | null}
                  category={item.category as string | null}
                  className="absolute inset-0 h-full w-full object-cover p-0"
                  hideCaption
                />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card via-card/72 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="mb-2 inline-flex rounded-full bg-card/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-warm-foreground backdrop-blur-sm">
                    {item.category}
                  </p>
                   <p className="font-display text-base leading-tight text-foreground line-clamp-2">
                    {item.title}
                  </p>
                </div>
              </button>
            ))}

            {sideItems.length === 0 && (
              <div className="flex h-[220px] items-center justify-center rounded-[1.5rem] border border-dashed border-border/60 bg-card/60 text-sm text-muted-foreground">
                Flow is warming up.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CompactFlowFeed;