/**
 * DiscoverTable — v10.3 Riipen × Dexscreener layout.
 *
 * Replaces the visual-heavy CreatorsGrid card layout with a dense, scannable
 * table. Each row = one creator with the at-a-glance signals that matter:
 * archetype, region, subscriber count, token (with $TICKER chip), open
 * listings count, last activity, and a single [Support] button that opens
 * the unified SupportSheet.
 *
 * Ranking reuses CreatorsGrid's quality gate (avatar + bio + works) so we
 * never list empty default profiles. Cap is higher here (50) because the
 * dense table can absorb more rows without feeling like a wall of voids.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { ARCHETYPE_BY_ID, type Archetype } from "@/lib/archetypes";
import { Users, Pin, Coins, Briefcase, ArrowRight } from "lucide-react";
import RegionChip from "@/components/profile/RegionChip";
import VerifiedArtistBadge from "@/components/profile/VerifiedArtistBadge";
import SupportSheet from "@/components/profile/SupportSheet";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

const QUALITY_THRESHOLD = 3;
const MAX_ROWS = 50;

const initials = (name?: string | null) =>
  (name ?? "")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "·";

interface Row {
  user_id: string;
  profile_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  region_code: string | null;
  verification_status: string | null;
  archetype: Archetype | null;
  token_ticker: string | null;
  token_mint_address: string | null;
  featured_pin_until: string | null;
  score: number;
  pinned: boolean;
  workCount: number;
  listingCount: number;
  subCount: number;
  lastActiveAt: string | null;
}

const DiscoverTable = ({
  search = "",
  archetype = null,
  onArchetypeClick,
}: {
  search?: string;
  archetype?: Archetype | null;
  onArchetypeClick?: (a: Archetype) => void;
}) => {
  const [supportFor, setSupportFor] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["discover-table", archetype ?? "all"],
    queryFn: async (): Promise<Row[]> => {
      let q = supabase
        .from("profiles")
        .select(
          "id, user_id, display_name, username, avatar_url, bio, region_code, verification_status, is_public, archetype, token_ticker, token_mint_address, featured_pin_until",
        )
        .neq("is_public", false)
        .limit(200);
      if (archetype === "artist") {
        q = q.or("archetype.eq.artist,archetype.is.null");
      } else if (archetype) {
        q = q.eq("archetype", archetype);
      }
      const { data: profiles, error } = await q;
      if (error) throw error;
      if (!profiles?.length) return [];

      const userIds = profiles.map((p: any) => p.user_id);
      const profileIds = profiles.map((p: any) => p.id);

      const [worksRes, listingsRes, subsRes] = await Promise.all([
        supabase
          .from("works")
          .select("user_id, created_at")
          .in("user_id", userIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("marketplace_listings")
          .select("user_id")
          .in("user_id", userIds)
          .eq("is_active", true),
        supabase
          .from("creator_subscriptions")
          .select("creator_id")
          .in("creator_id", profileIds)
          .eq("status", "active"),
      ]);

      const workCount = new Map<string, number>();
      const latestWorkAt = new Map<string, string>();
      (worksRes.data ?? []).forEach((w: any) => {
        workCount.set(w.user_id, (workCount.get(w.user_id) ?? 0) + 1);
        if (!latestWorkAt.has(w.user_id)) latestWorkAt.set(w.user_id, w.created_at);
      });
      const listingCount = new Map<string, number>();
      (listingsRes.data ?? []).forEach((l: any) => {
        listingCount.set(l.user_id, (listingCount.get(l.user_id) ?? 0) + 1);
      });
      const subCount = new Map<string, number>();
      (subsRes.data ?? []).forEach((s: any) => {
        subCount.set(s.creator_id, (subCount.get(s.creator_id) ?? 0) + 1);
      });

      const now = Date.now();
      const rows: Row[] = profiles.map((p: any) => {
        let score = 0;
        if (p.avatar_url) score += 3;
        if ((p.bio ?? "").length >= 40) score += 2;
        if (p.verification_status === "verified") score += 4;
        const wc = workCount.get(p.user_id) ?? 0;
        score += Math.min(wc, 5) * 3;
        const pinned =
          !!p.featured_pin_until && new Date(p.featured_pin_until).getTime() > now;

        return {
          user_id: p.user_id,
          profile_id: p.id,
          display_name: p.display_name,
          username: p.username,
          avatar_url: p.avatar_url,
          bio: p.bio,
          region_code: p.region_code,
          verification_status: p.verification_status,
          archetype: (p.archetype as Archetype | null) ?? null,
          token_ticker: p.token_ticker ?? null,
          token_mint_address: p.token_mint_address ?? null,
          featured_pin_until: p.featured_pin_until ?? null,
          score,
          pinned,
          workCount: wc,
          listingCount: listingCount.get(p.user_id) ?? 0,
          subCount: subCount.get(p.id) ?? 0,
          lastActiveAt: latestWorkAt.get(p.user_id) ?? null,
        };
      });

      const eligible = rows.filter((r) => r.pinned || r.score >= QUALITY_THRESHOLD);
      eligible.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.score - a.score;
      });
      return eligible.slice(0, MAX_ROWS);
    },
    staleTime: 60_000,
  });

  const term = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      (data ?? []).filter((r) => {
        if (!term) return true;
        return (
          r.display_name?.toLowerCase().includes(term) ||
          r.username?.toLowerCase().includes(term) ||
          r.bio?.toLowerCase().includes(term) ||
          r.token_ticker?.toLowerCase().includes(term)
        );
      }),
    [data, term],
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!filtered.length) {
    return (
      <EmptyState
        icon={Users}
        title={term ? "No creators match that search" : "No creators featured yet"}
        description={
          term
            ? "Try a different word or clear the search."
            : "Featured creators need an avatar, a bio, and a few works first."
        }
        size="lg"
      />
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow className="border-border/60 hover:bg-transparent">
              <TableHead className="w-[34%]">Creator</TableHead>
              <TableHead className="hidden md:table-cell">Region</TableHead>
              <TableHead className="text-right">Subs</TableHead>
              <TableHead className="hidden sm:table-cell">Token</TableHead>
              <TableHead className="hidden lg:table-cell text-right">Listings</TableHead>
              <TableHead className="hidden md:table-cell">Last active</TableHead>
              <TableHead className="text-right">Support</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => {
              const name = r.display_name ?? r.username ?? "Creator";
              const meta = r.archetype ? ARCHETYPE_BY_ID.get(r.archetype) : null;
              const last = r.lastActiveAt
                ? formatDistanceToNow(new Date(r.lastActiveAt), { addSuffix: true })
                : "—";

              return (
                <TableRow key={r.user_id} className="border-border/40">
                  <TableCell>
                    <div className="flex items-center gap-3 min-w-0">
                      <Link
                        to={`/profiles/${r.user_id}`}
                        className="shrink-0"
                        aria-label={`Open ${name}'s profile`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={r.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px] font-semibold">
                            {initials(name)}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Link
                            to={`/profiles/${r.user_id}`}
                            className="font-medium text-sm text-foreground truncate hover:underline underline-offset-2"
                          >
                            {name}
                          </Link>
                          {meta && (
                            <button
                              type="button"
                              onClick={() => onArchetypeClick?.(meta.id)}
                              title={meta.label}
                              className={cn("h-2 w-2 rounded-full shrink-0", meta.dotClass)}
                              aria-label={`Filter by ${meta.label}`}
                            />
                          )}
                          {r.verification_status === "verified" && (
                            <VerifiedArtistBadge status="verified" size="xs" showLabel={false} />
                          )}
                          {r.pinned && (
                            <Pin className="h-3 w-3 text-foreground/70 shrink-0" />
                          )}
                        </div>
                        {r.bio && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 break-words">
                            {r.bio.split("\n")[0]}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <RegionChip code={r.region_code} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm text-foreground/80">
                    {r.subCount}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {r.token_ticker ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                        <Coins className="h-3 w-3" />${r.token_ticker}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-right tabular-nums text-sm text-foreground/80">
                    {r.listingCount > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="h-3 w-3 text-muted-foreground" />
                        {r.listingCount}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {last}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      className="h-7 rounded-full text-xs gap-1"
                      onClick={() => setSupportFor({ id: r.profile_id, name })}
                    >
                      Support
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-center pt-2">
        <Link
          to="/profiles"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Browse all creators <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {supportFor && (
        <SupportSheet
          open={!!supportFor}
          onOpenChange={(v) => !v && setSupportFor(null)}
          creatorId={supportFor.id}
          creatorName={supportFor.name}
        />
      )}
    </>
  );
};

export default DiscoverTable;
