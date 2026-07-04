/**
 * ProfileBentoCanvas — v12.1 SoundCloud/MySpace-style content-forward
 * profile lower half.
 *
 * Drops the loud Coin panel / Collaborators / Services blocks per the
 * "tone it down" pass. Keeps Featured Release as the hero, Flow strip
 * for visual proof, and a text-first Releases list (no more sad empty
 * folder tiles). Coin, when present, is a slim chip on the featured
 * card — not its own screaming panel.
 *
 * Now inherits `.kinetic-theme` tokens which map to the app's light
 * palette + mint accent, so it matches the rest of the surface.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Coins,
  FolderKanban,
  Play,
  Music,
  Image as ImageIcon,
  Plus,
  Rocket,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AttachCoinLauncher from "@/components/coin/AttachCoinLauncher";

interface Props {
  userId: string;
  isOwnProfile: boolean;
  displayName: string;
  onStartProject?: () => void;
}

const ProfileBentoCanvas = ({ userId, isOwnProfile, displayName, onStartProject }: Props) => {
  const navigate = useNavigate();
  const [launcherOpen, setLauncherOpen] = useState(false);

  const { data: projects } = useQuery({
    queryKey: ["bento-projects", userId],
    queryFn: async () => {
      const { data } = await supabase.from("projects")
        .select("id, title, description, status, cover_color, cover_image_url, created_at, linked_token_mint, linked_token_ticker")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!userId,
  });

  const { data: works } = useQuery({
    queryKey: ["bento-works", userId],
    queryFn: async () => {
      const { data } = await supabase.from("works")
        .select("id, title, kind, cover_url, thumbnail_url, file_url, created_at")
        .eq("user_id", userId)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(12);
      return data ?? [];
    },
    enabled: !!userId,
  });

  const { data: flowItems } = useQuery({
    queryKey: ["bento-flow", userId],
    queryFn: async () => {
      const { data } = await supabase.from("flow_items")
        .select("id, title, file_url, link_url, category, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12);
      return data ?? [];
    },
    enabled: !!userId,
  });

  const { data: primaryToken } = useQuery({
    queryKey: ["bento-primary-token", userId],
    queryFn: async () => {
      const { data } = await supabase.from("creator_tokens")
        .select("mint_address, ticker, name")
        .eq("user_id", userId)
        .eq("status", "approved")
        .order("is_primary", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  const featured = useMemo(() => projects?.[0], [projects]);
  const otherReleases = useMemo(() => (projects ?? []).slice(1), [projects]);

  const strip = useMemo(() => {
    const list = (works ?? []).filter((w: any) => w.cover_url || w.thumbnail_url || w.file_url);
    if (list.length >= 4) return list.slice(0, 8);
    const legacy = (flowItems ?? []).map((f: any) => ({
      id: f.id,
      title: f.title,
      kind: f.category ?? "post",
      cover_url: f.file_url,
      _legacy: true,
    }));
    return [...list, ...legacy].slice(0, 8);
  }, [works, flowItems]);

  return (
    <div className="kinetic-theme rounded-2xl mt-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* LEFT: Featured Release (spans 2 cols on lg) */}
        <div className="lg:col-span-2">
          <FeaturedTile
            project={featured}
            token={primaryToken}
            isOwnProfile={isOwnProfile}
            displayName={displayName}
            onStart={onStartProject}
            onAttachCoin={() => setLauncherOpen(true)}
            onOpen={(id: string) => navigate(`/projects/${id}`)}
          />

          {/* Flow strip — MySpace mood board */}
          <div className="mt-4 rounded-2xl p-4 border" style={{ background: "var(--kb-surface)", borderColor: "var(--kb-border)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-baseline gap-2">
                <h3 className="kb-display text-base">Flow</h3>
                <span className="text-[10px] uppercase tracking-widest" style={{ color: "var(--kb-fg-faint)" }}>
                  {strip.length} recent
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/flow?user=${userId}`)}
                className="text-[10px] uppercase tracking-widest font-bold inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
                style={{ color: "var(--kb-accent)" }}
              >
                Open feed <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
            {strip.length === 0 ? (
              <p className="text-xs py-4 text-center" style={{ color: "var(--kb-fg-faint)" }}>
                {isOwnProfile ? "Drop a work in Flow to fill this out." : "Nothing posted yet."}
              </p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                {strip.map((w: any) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => navigate(w._legacy ? `/flow?item=${w.id}` : `/works/${w.id}`)}
                    className="relative aspect-square rounded-lg overflow-hidden group"
                    style={{ background: "var(--kb-surface-2)" }}
                    title={w.title || "Untitled"}
                  >
                    {(w.cover_url || w.thumbnail_url) ? (
                      <img src={w.thumbnail_url || w.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ color: "var(--kb-fg-faint)" }}>
                        {w.kind === "audio" || w.kind === "music" ? <Music className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                      </div>
                    )}
                    {w.kind === "video" && (
                      <div className="absolute top-1 left-1 h-5 w-5 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(0,0,0,0.55)" }}>
                        <Play className="h-2.5 w-2.5 fill-white text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Releases list (SoundCloud-style) */}
        <div className="rounded-2xl p-4 border" style={{ background: "var(--kb-surface)", borderColor: "var(--kb-border)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline gap-2">
              <h3 className="kb-display text-base">Releases</h3>
              <span className="text-[10px] uppercase tracking-widest" style={{ color: "var(--kb-fg-faint)" }}>
                {projects?.length ?? 0} total
              </span>
            </div>
            {isOwnProfile && (
              <button
                type="button"
                onClick={onStartProject}
                className="text-[10px] uppercase tracking-widest font-bold inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
                style={{ color: "var(--kb-accent)" }}
              >
                New <Plus className="h-3 w-3" />
              </button>
            )}
          </div>

          {otherReleases.length === 0 && !featured ? (
            <div className="py-8 text-center text-xs flex flex-col items-center gap-2" style={{ color: "var(--kb-fg-faint)" }}>
              <FolderKanban className="h-5 w-5" />
              <span>No releases yet</span>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--kb-border)" }}>
              {(otherReleases.length === 0 ? [] : otherReleases).map((p: any, i: number) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="w-full flex items-center gap-3 py-2.5 text-left group hover:opacity-80 transition-opacity"
                  >
                    <span className="kb-display text-xs w-6 flex-shrink-0" style={{ color: "var(--kb-fg-faint)" }}>
                      {String(i + 2).padStart(2, "0")}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold truncate" style={{ color: "var(--kb-fg)" }}>
                        {p.title}
                      </span>
                      <span className="block text-[11px] truncate" style={{ color: "var(--kb-fg-faint)" }}>
                        {p.linked_token_ticker ? `$${p.linked_token_ticker}` : (p.description || p.status || "Draft")}
                      </span>
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--kb-fg-dim)" }} />
                  </button>
                </li>
              ))}
              {otherReleases.length === 0 && featured && (
                <li className="py-4 text-xs text-center" style={{ color: "var(--kb-fg-faint)" }}>
                  Only the featured release so far.
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {isOwnProfile && (
        <AttachCoinLauncher open={launcherOpen} onOpenChange={setLauncherOpen} />
      )}
    </div>
  );
};

const FeaturedTile = ({ project, token, isOwnProfile, displayName, onStart, onAttachCoin, onOpen }: any) => {
  if (!project) {
    return (
      <div className="rounded-2xl p-8 border flex flex-col justify-between overflow-hidden relative min-h-[280px]"
        style={{ background: "var(--kb-surface)", borderColor: "var(--kb-border)" }}>
        <div className="absolute inset-0 opacity-40 pointer-events-none"
          style={{ background: "radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--kb-accent) 25%, transparent), transparent 60%)" }} />
        <div className="relative">
          <span className="text-[10px] uppercase tracking-[0.25em] font-bold" style={{ color: "var(--kb-accent)" }}>
            Featured Release
          </span>
        </div>
        <div className="relative">
          <h2 className="kb-display text-3xl md:text-4xl leading-[0.95] max-w-md">
            {isOwnProfile ? "Start your first release" : `${displayName} hasn't released yet`}
          </h2>
          {isOwnProfile && (
            <button
              type="button"
              onClick={onStart}
              className="mt-5 inline-flex items-center gap-2 kb-display text-sm px-5 py-2.5 rounded-xl transition-transform hover:scale-[1.02]"
              style={{ background: "var(--kb-accent)", color: "#fff" }}
            >
              <Rocket className="h-3.5 w-3.5" /> Spin up a release
            </button>
          )}
        </div>
      </div>
    );
  }

  const hasCover = !!project.cover_image_url;
  const showCoinChip = !!token?.ticker;

  return (
    <div className="rounded-2xl overflow-hidden border relative min-h-[280px] flex flex-col"
      style={{
        background: hasCover ? "var(--kb-surface-2)" : (project.cover_color || "var(--kb-surface)"),
        borderColor: "var(--kb-border)",
      }}>
      {hasCover && (
        <img
          src={project.cover_image_url}
          alt={project.title}
          className="absolute inset-0 h-full w-full object-cover opacity-80"
        />
      )}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65), transparent 55%)" }} />

      <button
        type="button"
        onClick={() => onOpen(project.id)}
        className="relative flex-1 flex flex-col justify-between p-6 md:p-7 text-left group"
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "color-mix(in srgb, var(--kb-accent) 18%, transparent)", color: "var(--kb-accent)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--kb-accent)" }} />
            Featured Release
          </span>
          <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-white" />
        </div>
        <div>
          <h2 className="kb-display text-3xl md:text-5xl leading-[0.95] text-white drop-shadow-sm">
            {project.title}
          </h2>
          {project.description && (
            <p className="mt-2 text-sm max-w-lg line-clamp-2 text-white/80">
              {project.description}
            </p>
          )}
        </div>
      </button>

      {/* Slim coin strip — attached OR CTA. No screaming panel. */}
      <div className="relative border-t px-6 py-2.5 flex items-center justify-between text-xs"
        style={{ borderColor: "rgba(255,255,255,0.15)", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)" }}>
        {showCoinChip ? (
          <a
            href={`https://pump.fun/coin/${token.mint_address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-bold hover:opacity-80 transition-opacity"
            style={{ color: "var(--kb-accent)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--kb-accent)" }} />
            ${token.ticker} · trade on pump.fun
          </a>
        ) : isOwnProfile ? (
          <button
            type="button"
            onClick={onAttachCoin}
            className="inline-flex items-center gap-1.5 font-bold hover:opacity-80 transition-opacity"
            style={{ color: "var(--kb-accent)" }}
          >
            <Coins className="h-3 w-3" /> Attach a coin
          </button>
        ) : (
          <span className="text-white/60">No coin attached</span>
        )}
        <span className="text-white/60 uppercase tracking-widest text-[10px] font-semibold">
          {project.status || "Live"}
        </span>
      </div>
    </div>
  );
};

export default ProfileBentoCanvas;
