import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  Building2,
  Briefcase,
  MapPin,
  Clock,
  DollarSign,
  Search,
  ArrowUpRight,
  MessageSquare,
  Inbox,
  Sparkles,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import PostMenuButton from "@/components/PostMenuButton";
import { avatarGradientFor } from "@/lib/avatar-gradient";

/**
 * CONNECT — Room 2 (creator-led work room).
 *
 * v9.5: previously "The Market". Reframed as Connect — a Riipen-style
 * split-pane board where you scan listings on the left and preview the
 * selected one on the right. Three inline filter chips (Hire · Spaces ·
 * Open Calls) switch the source — no page jumps. Every row leads to a
 * profile, inquiry (→ Inbox), or booking (→ Projects).
 */

type Kind = "hire" | "space" | "call";

const KINDS: { key: Kind; label: string; desc: string; Icon: typeof Users }[] = [
  { key: "hire", label: "Hire Creators", desc: "Book talent · creator services", Icon: Users },
  { key: "space", label: "Spaces", desc: "Studios & venues hosted by creators", Icon: Building2 },
  { key: "call", label: "Open Calls", desc: "Gigs, jobs & briefs", Icon: Briefcase },
];

interface Row {
  id: string;
  kind: Kind;
  title: string;
  subtitle?: string | null;
  priceLabel?: string | null;
  metaLabel?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  ownerAvatar?: string | null;
  category?: string | null;
  description?: string | null;
  detailHref: string;
  coverUrl?: string | null;
}

/* ----------------------------------------------------------------------------
 * Data fetchers
 * ------------------------------------------------------------------------- */

const useHireRows = (enabled: boolean) =>
  useQuery({
    enabled,
    queryKey: ["connect", "hire"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("id,title,description,category,price,currency,credits_price,delivery_days,cover_url,user_id,listing_type")
        .eq("is_active", true)
        .eq("listing_type", "service")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      const ownerIds = Array.from(new Set((data ?? []).map((d) => d.user_id)));
      const { data: profs } = ownerIds.length
        ? await supabase.from("profiles").select("id,display_name,username,avatar_url").in("id", ownerIds)
        : { data: [] as any[] };
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return (data ?? []).map((l: any) => {
        const p = map.get(l.user_id);
        const price =
          l.price != null
            ? `${l.currency || "USD"} ${Number(l.price).toLocaleString()}`
            : l.credits_price != null
              ? `${Number(l.credits_price).toLocaleString()} $RHOZE`
              : null;
        return {
          id: l.id,
          kind: "hire" as const,
          title: l.title,
          subtitle: p?.display_name || p?.username || "Creator",
          priceLabel: price,
          metaLabel: l.delivery_days ? `${l.delivery_days}d delivery` : null,
          ownerId: l.user_id,
          ownerName: p?.display_name || p?.username || null,
          ownerAvatar: p?.avatar_url || null,
          category: l.category,
          description: l.description,
          detailHref: `/marketplace/${l.id}`,
          coverUrl: l.cover_url,
        };
      });
    },
  });

const useSpaceRows = (enabled: boolean) =>
  useQuery({
    enabled,
    queryKey: ["connect", "space"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("studios")
        .select("id,name,short_description,city,country,category,hourly_rate,cover_image_url,owner_id")
        .eq("is_active", true)
        .eq("status", "approved")
        .order("rating_avg", { ascending: false })
        .limit(60);
      if (error) throw error;
      const ownerIds = Array.from(new Set((data ?? []).map((d: any) => d.owner_id).filter(Boolean)));
      const { data: profs } = ownerIds.length
        ? await supabase.from("profiles").select("id,display_name,username,avatar_url").in("id", ownerIds)
        : { data: [] as any[] };
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return (data ?? []).map((s: any) => {
        const p = map.get(s.owner_id);
        return {
          id: s.id,
          kind: "space" as const,
          title: s.name,
          subtitle: [s.city, s.country].filter(Boolean).join(", ") || "Location TBA",
          priceLabel: s.hourly_rate ? `$${s.hourly_rate}/hr` : null,
          metaLabel: s.category,
          ownerId: s.owner_id,
          ownerName: p?.display_name || p?.username || null,
          ownerAvatar: p?.avatar_url || null,
          category: s.category,
          description: s.short_description,
          detailHref: `/studios/${s.id}`,
          coverUrl: s.cover_image_url,
        };
      });
    },
  });

const useCallRows = (enabled: boolean) =>
  useQuery({
    enabled,
    queryKey: ["connect", "call"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("id,title,description,category,price,currency,credits_price,delivery_days,cover_url,user_id,listing_type")
        .eq("is_active", true)
        .in("listing_type", ["project_request", "collaboration"])
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      const ownerIds = Array.from(new Set((data ?? []).map((d) => d.user_id)));
      const { data: profs } = ownerIds.length
        ? await supabase.from("profiles").select("id,display_name,username,avatar_url").in("id", ownerIds)
        : { data: [] as any[] };
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return (data ?? []).map((l: any) => {
        const p = map.get(l.user_id);
        const price =
          l.price != null
            ? `Budget ${l.currency || "USD"} ${Number(l.price).toLocaleString()}`
            : null;
        return {
          id: l.id,
          kind: "call" as const,
          title: l.title,
          subtitle: p?.display_name || p?.username || "Creator",
          priceLabel: price,
          metaLabel:
            l.listing_type === "collaboration"
              ? "Collab"
              : l.delivery_days
                ? `${l.delivery_days}d deadline`
                : "Open call",
          ownerId: l.user_id,
          ownerName: p?.display_name || p?.username || null,
          ownerAvatar: p?.avatar_url || null,
          category: l.category,
          description: l.description,
          detailHref: `/marketplace/${l.id}`,
          coverUrl: l.cover_url,
        };
      });
    },
  });

/* ----------------------------------------------------------------------------
 * UI
 * ------------------------------------------------------------------------- */

const MarketRoomPage = () => {
  const [kind, setKind] = useState<Kind>("hire");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const navigate = useNavigate();

  const hire = useHireRows(kind === "hire");
  const spaces = useSpaceRows(kind === "space");
  const calls = useCallRows(kind === "call");

  const query = kind === "hire" ? hire : kind === "space" ? spaces : calls;
  const rows = query.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.subtitle || "").toLowerCase().includes(q) ||
        (r.category || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const selected = useMemo(
    () => filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const Heading = KINDS.find((k) => k.key === kind)!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <span className="text-[10px] uppercase tracking-[0.28em] text-primary font-semibold">
          Connect
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground leading-tight">
          Find your next collaborator.
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          Hire creators, book their spaces, or browse open calls. Tap any row to preview —
          inquiries land in your Inbox, bookings become Projects.
        </p>
      </div>

      {/* Filter chips + actions */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-2">
          {KINDS.map(({ key, label, Icon }) => {
            const active = kind === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setKind(key);
                  setSelectedId(null);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium border transition-all",
                  active
                    ? "bg-foreground text-background border-foreground shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/40",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <PostMenuButton
            trigger={
              <Button size="sm" className="rounded-full">
                <Plus className="mr-1.5 h-4 w-4" /> Post
              </Button>
            }
          />
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Search ${Heading.label.toLowerCase()}…`}
          className="pl-10 rounded-full h-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Split pane */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
        {/* LEFT — dense list */}
        <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span>{filtered.length} results</span>
            <span className="hidden sm:inline">{Heading.desc}</span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-border/50">
            {query.isLoading && (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-muted/50 animate-pulse rounded-lg" />
                ))}
              </div>
            )}
            {!query.isLoading && filtered.length === 0 && (
              <div className="p-10 text-center">
                <Heading.Icon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No {Heading.label.toLowerCase()} yet.</p>
              </div>
            )}
            {filtered.map((row) => {
              const active = selected?.id === row.id;
              const grad = avatarGradientFor(row.ownerId || row.id);
              return (
                <button
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 transition-colors flex items-start gap-3",
                    active ? "bg-muted/70" : "hover:bg-muted/40",
                  )}
                >
                  <div
                    className="shrink-0 h-10 w-10 rounded-lg overflow-hidden ring-1 ring-border/60"
                    style={{ background: grad.background }}
                  >
                    {row.ownerAvatar ? (
                      <img src={row.ownerAvatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Heading.Icon className="h-4 w-4 text-foreground/70 m-auto mt-3" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-sm text-foreground leading-snug line-clamp-2">
                        {row.title}
                      </h3>
                      {row.priceLabel && (
                        <span className="shrink-0 text-xs font-semibold text-foreground tabular-nums">
                          {row.priceLabel}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      {row.subtitle && <span className="truncate">{row.subtitle}</span>}
                      {row.metaLabel && (
                        <>
                          <span>·</span>
                          <span>{row.metaLabel}</span>
                        </>
                      )}
                      {row.category && (
                        <>
                          <span>·</span>
                          <span className="capitalize">{row.category}</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT — detail preview */}
        <div className="rounded-2xl border border-border bg-card/60 overflow-hidden min-h-[400px]">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="p-5 sm:p-6 space-y-5"
              >
                {/* Owner row */}
                {selected.ownerId && (
                  <Link
                    to={`/profiles/${selected.ownerId}`}
                    className="inline-flex items-center gap-2 group"
                  >
                    <div
                      className="h-8 w-8 rounded-full overflow-hidden ring-1 ring-border/60"
                      style={{ background: avatarGradientFor(selected.ownerId).background }}
                    >
                      {selected.ownerAvatar && (
                        <img src={selected.ownerAvatar} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="text-xs">
                      <div className="font-medium text-foreground group-hover:underline">
                        {selected.ownerName || "Creator"}
                      </div>
                      <div className="text-muted-foreground">View profile →</div>
                    </div>
                  </Link>
                )}

                {/* Title block */}
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    <Heading.Icon className="h-3 w-3" />
                    {Heading.label.replace(/s$/, "")}
                  </span>
                  <h2 className="font-display text-2xl font-bold text-foreground leading-tight">
                    {selected.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {selected.priceLabel && (
                      <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                        <DollarSign className="h-3 w-3" /> {selected.priceLabel}
                      </span>
                    )}
                    {selected.metaLabel && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {selected.metaLabel}
                      </span>
                    )}
                    {selected.kind === "space" && selected.subtitle && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {selected.subtitle}
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {selected.description && (
                  <p className="text-sm text-foreground/80 leading-relaxed line-clamp-6 whitespace-pre-wrap">
                    {selected.description}
                  </p>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    onClick={() => navigate(selected.detailHref)}
                    className="rounded-full"
                  >
                    Open full {Heading.label.replace(/s$/, "").toLowerCase()}
                    <ArrowUpRight className="ml-1.5 h-4 w-4" />
                  </Button>
                  {selected.kind !== "space" && (
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => navigate(`${selected.detailHref}?inquire=1`)}
                    >
                      <MessageSquare className="mr-1.5 h-4 w-4" />
                      Inquire
                    </Button>
                  )}
                  {selected.ownerId && (
                    <Button
                      variant="ghost"
                      className="rounded-full"
                      onClick={() => navigate(`/messages?to=${selected.ownerId}`)}
                    >
                      <Inbox className="mr-1.5 h-4 w-4" />
                      Message
                    </Button>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                  <Sparkles className="inline h-3 w-3 mr-1" />
                  Inquiries appear in your <Link to="/messages" className="underline hover:text-foreground">Inbox</Link>;
                  accepted bookings become <Link to="/messages?tab=projects" className="underline hover:text-foreground">Projects</Link>.
                </p>
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-10 text-center">
                Pick a row on the left to preview.
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default MarketRoomPage;
