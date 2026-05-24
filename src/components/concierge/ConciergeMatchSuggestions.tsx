/**
 * ConciergeMatchSuggestions — Phase 4
 *
 * Surfaces top creator matches for a Concierge brief inside the request
 * detail. Matches profiles by searching `creator_roles` + `bio` + `display_name`
 * against the brief's category/summary keywords, scored by a lightweight
 * completeness heuristic (verified > avatar > bio length). "Add to proposal"
 * appends the @handle into the proposal notes textarea (managed by parent).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, ShieldCheck, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  category: string | null;
  summary: string | null;
  outcome: string | null;
  onAddToProposal: (handle: string, displayName: string) => void;
}

const STOPWORDS = new Set([
  "the","a","an","for","with","and","or","of","to","in","on","by","my","our","is",
  "are","want","need","looking","help","get","make","build","create","new",
]);

function keywordsFrom(...parts: Array<string | null>): string[] {
  const text = parts.filter(Boolean).join(" ").toLowerCase();
  const tokens = text.match(/[a-z]{3,}/g) ?? [];
  const uniq = Array.from(new Set(tokens.filter((t) => !STOPWORDS.has(t))));
  return uniq.slice(0, 6);
}

export default function ConciergeMatchSuggestions({
  category, summary, outcome, onAddToProposal,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const keywords = useMemo(
    () => keywordsFrom(category, summary, outcome),
    [category, summary, outcome],
  );

  const { data: matches, isLoading } = useQuery({
    queryKey: ["concierge-matches", keywords.join("|")],
    enabled: keywords.length > 0,
    queryFn: async () => {
      // Build an OR search across bio/display_name/username for each keyword.
      // Limit to 24 candidates; we'll re-rank client-side.
      const orClause = keywords
        .flatMap((k) => [
          `bio.ilike.%${k}%`,
          `display_name.ilike.%${k}%`,
          `username.ilike.%${k}%`,
        ])
        .join(",");

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "user_id, display_name, username, bio, avatar_url, creator_roles, verification_status, archetype",
        )
        .or(orClause)
        .limit(24);
      if (error) throw error;

      // Score: verified +5, has avatar +1, bio length /50, matching keyword count *2.
      const scored = (data ?? []).map((p: any) => {
        const text = `${p.bio ?? ""} ${(p.creator_roles ?? []).join(" ")} ${p.display_name ?? ""}`.toLowerCase();
        const matchCount = keywords.filter((k) => text.includes(k)).length;
        const score =
          matchCount * 2 +
          (p.verification_status === "verified" ? 5 : 0) +
          (p.avatar_url ? 1 : 0) +
          Math.min((p.bio?.length ?? 0) / 50, 2);
        return { ...p, _score: score, _matches: matchCount };
      });
      return scored
        .filter((p) => p._matches > 0 && p.username)
        .sort((a, b) => b._score - a._score)
        .slice(0, 8);
    },
  });

  if (keywords.length === 0) return null;

  const visible = expanded ? matches : matches?.slice(0, 3);

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-600" />
          <p className="text-[10px] uppercase tracking-widest text-foreground font-medium">
            Suggested creators
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {keywords.slice(0, 3).join(" · ")}
        </span>
      </div>

      {isLoading && (
        <p className="text-xs text-muted-foreground">Searching matches…</p>
      )}

      {!isLoading && (matches?.length ?? 0) === 0 && (
        <p className="text-xs text-muted-foreground">
          No strong matches yet — try browsing the directory manually.
        </p>
      )}

      <div className="space-y-2">
        {visible?.map((p) => (
          <div
            key={p.user_id}
            className="flex items-center gap-2.5 rounded-lg bg-background/60 border border-border p-2.5"
          >
            <Avatar className="h-9 w-9">
              <AvatarImage src={p.avatar_url ?? ""} />
              <AvatarFallback className="text-[10px]">
                {(p.display_name || p.username || "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-foreground truncate">
                  {p.display_name || p.username}
                </p>
                {p.verification_status === "verified" && (
                  <ShieldCheck className="h-3 w-3 text-sky-500 shrink-0" />
                )}
                <Badge variant="outline" className="text-[9px] py-0 px-1.5">
                  {p._matches} match{p._matches > 1 ? "es" : ""}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">
                @{p.username}
                {p.creator_roles?.length ? ` · ${p.creator_roles.slice(0, 2).join(", ")}` : ""}
              </p>
            </div>
            <Link
              to={`/u/${p.username}`}
              target="_blank"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px] gap-1"
              onClick={() =>
                onAddToProposal(p.username, p.display_name || p.username)
              }
            >
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>
        ))}
      </div>

      {(matches?.length ?? 0) > 3 && (
        <Button
          size="sm"
          variant="ghost"
          className="w-full text-[11px] h-7"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "Show fewer" : `Show ${(matches?.length ?? 0) - 3} more`}
        </Button>
      )}
    </div>
  );
}
