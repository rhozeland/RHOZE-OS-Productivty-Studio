/**
 * ListingsBoard — Riipen-style split-pane browser for marketplace listings.
 *
 * Mounted as the "Listings" tab on the Feed page. Filters on top
 * (keyword + category + listing type), left column shows the result rail,
 * right column shows the selected listing in detail with the same CTAs
 * as <ListingLightbox /> (Start a project · Message · Full page).
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpDown,
  Bookmark,
  Briefcase,
  Clock,
  DollarSign,
  ExternalLink,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listingMeta } from "@/lib/listing-types";
import { EmptyState } from "@/components/ui/empty-state";

const ListingsBoard = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<"newest" | "title">("newest");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["listings-board"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_listings")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    listings.forEach((l: any) => l.category && set.add(l.category));
    return Array.from(set).sort();
  }, [listings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = listings.filter((l: any) => {
      if (category !== "all" && l.category !== category) return false;
      if (q) {
        const hay = `${l.title} ${l.description ?? ""} ${(l.tags ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sort === "title") {
      rows = [...rows].sort((a: any, b: any) => a.title.localeCompare(b.title));
    }
    return rows;
  }, [listings, query, category, sort]);

  const selected = useMemo(
    () => filtered.find((l: any) => l.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const { data: creator } = useQuery({
    queryKey: ["listings-board-creator", selected?.user_id],
    enabled: !!selected?.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url, archetype")
        .eq("user_id", selected.user_id)
        .maybeSingle();
      return data;
    },
  });

  const handleStartProject = (l: any) => {
    try {
      sessionStorage.setItem(
        "newProjectPrefill",
        JSON.stringify({
          title: l.title,
          listingId: l.id,
          collaboratorId: l.user_id,
          scope: l.description ?? null,
        }),
      );
    } catch {}
    navigate(`/messages?tab=projects&new=1`);
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Keyword, skill, or title"
            className="pl-9 rounded-full"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="rounded-full min-w-[160px]">
            <SelectValue placeholder="Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as any)}>
          <SelectTrigger className="rounded-full min-w-[140px]">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="title">Title (A–Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Result count (type filter retired in v11.1 — unified listing feed) */}
      <div className="flex justify-end">
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {filtered.length} result{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Split pane */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,360px)_1fr] gap-4">
        {/* Results rail */}
        <div className="space-y-2 lg:max-h-[720px] lg:overflow-y-auto lg:pr-1 scrollbar-none order-2 lg:order-1">
          {isLoading && (
            <div className="text-xs text-muted-foreground py-8 text-center">Loading…</div>
          )}
          {!isLoading && filtered.length === 0 && (
            listings.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title="No listings yet"
                description="Listings are how creators announce what they're hiring for, collaborating on, or selling. Be the first to post one."
                cta={{ label: "Post a listing", to: "/discover#discover-composer" }}
                size="md"
              />
            ) : (
              <EmptyState
                icon={Search}
                title="Nothing matches those filters"
                description="Try a different keyword or clear the category filter."
                cta={{
                  label: "Clear filters",
                  onClick: () => {
                    setQuery("");
                    setCategory("all");
                  },
                }}
                size="sm"
              />
            )
          )}
          {filtered.map((l: any) => {
            const meta = listingMeta(l.listing_type);
            const Icon = meta.icon;
            const isActive = selected?.id === l.id;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelectedId(l.id)}
                className={cn(
                  "w-full text-left rounded-2xl border bg-card/60 p-3 transition-all hover:bg-card hover:border-foreground/30",
                  isActive && "border-foreground/60 bg-card shadow-sm ring-1 ring-foreground/10",
                )}
              >
                <div className="flex gap-3">
                  <div className="shrink-0 h-12 w-12 rounded-lg overflow-hidden bg-muted">
                    {l.cover_url ? (
                      <img src={l.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className={cn("w-full h-full flex items-center justify-center", meta.chip)}>
                        <Icon className="h-5 w-5 opacity-60" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{l.title}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium", meta.chip)}>
                        <Icon className="h-2.5 w-2.5" /> {meta.label}
                      </span>
                      {l.category && (
                        <span className="text-muted-foreground capitalize">{l.category}</span>
                      )}
                      {l.delivery_days && (
                        <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" /> {l.delivery_days}d
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        <div className="order-1 lg:order-2">
          {selected ? (
            <div className="rounded-3xl border border-border/70 bg-card/60 overflow-hidden flex flex-col">
              {selected.cover_url ? (
                <div className="aspect-[16/7] bg-muted">
                  <img src={selected.cover_url} alt={selected.title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="h-2 bg-gradient-to-r from-primary/40 via-accent/40 to-primary/40" />
              )}

              <div className="p-5 sm:p-6 space-y-4">
                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const meta = listingMeta(selected.listing_type);
                    const Icon = meta.icon;
                    return (
                      <Badge variant="secondary" className={cn("gap-1 text-[10px]", meta.chip)}>
                        <Icon className="h-3 w-3" /> {meta.label}
                      </Badge>
                    );
                  })()}
                  {selected.category && (
                    <Badge variant="outline" className="text-[10px] capitalize">{selected.category}</Badge>
                  )}
                  {selected.delivery_days && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" /> {selected.delivery_days}d delivery
                    </span>
                  )}
                  {selected.contact_info && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <DollarSign className="h-3 w-3" /> {selected.contact_info}
                    </span>
                  )}
                </div>

                <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight leading-tight">
                  {selected.title}
                </h2>

                {creator && (
                  <Link
                    to={`/profiles/${selected.user_id}`}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={creator.avatar_url || ""} />
                      <AvatarFallback className="text-[10px]">{(creator.display_name || "?").charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span>by <span className="font-medium text-foreground">{creator.display_name || creator.username}</span></span>
                  </Link>
                )}

                {selected.description && (
                  <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
                    {selected.description}
                  </p>
                )}

                {selected.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.tags.map((t: string) => (
                      <span key={t} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="border-t border-border/60 pt-4 flex flex-wrap gap-2">
                  <Button onClick={() => handleStartProject(selected)} className="gap-1.5">
                    <Plus className="h-4 w-4" /> Start a project from this
                  </Button>
                  <Button variant="outline" onClick={() => navigate(`/messages?with=${selected.user_id}&listing=${selected.id}`)} className="gap-1.5">
                    <MessageCircle className="h-4 w-4" /> Message
                  </Button>
                  <Button variant="ghost" asChild className="gap-1.5">
                    <Link to={`/listings/${selected.id}`}>
                      Full page <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" className="ml-auto" title="Save">
                    <Bookmark className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Select a listing on the left to preview it here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListingsBoard;
