/**
 * ProfileBentoCanvas — Kinetic Bento redesign of the profile bottom half.
 *
 * Replaces the icon tab strip + tab content on ProfileDetailPage with a
 * single mixed-size grid of tiles. Midnight+mint theme, Archivo Black
 * display type. Scoped via `.kinetic-theme` — doesn't affect the rest
 * of the app.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Coins,
  ExternalLink,
  FolderKanban,
  Play,
  Music,
  Image as ImageIcon,
  Plus,
  Rocket,
  Users,
  Briefcase,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCreatorTokenMetrics, fmtUsdCompact, fmtCount } from "@/hooks/useCreatorTokenMetrics";
import { cn } from "@/lib/utils";
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

  // Featured / building projects
  const { data: projects } = useQuery({
    queryKey: ["bento-projects", userId],
    queryFn: async () => {
      const { data } = await supabase.from("projects")
        .select("id, title, description, status, cover_color, cover_image_url, created_at, linked_token_mint, linked_token_ticker")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
    enabled: !!userId,
  });

  // Works — always visual thumbnails
  const { data: works } = useQuery({
    queryKey: ["bento-works", userId],
    queryFn: async () => {
      const { data } = await supabase.from("works")
        .select("id, title, kind, cover_url, thumbnail_url, file_url, created_at")
        .eq("user_id", userId)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
    enabled: !!userId,
  });

  // Flow items (source of the visual grid the user showed as reference)
  const { data: flowItems } = useQuery({
    queryKey: ["bento-flow", userId],
    queryFn: async () => {
      const { data } = await supabase.from("flow_items")
        .select("id, title, file_url, link_url, category, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
    enabled: !!userId,
  });

  // Primary token → live metrics
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

  const { data: metrics } = useCreatorTokenMetrics(primaryToken?.mint_address);

  // Services (creator_roles + offerings)
  const { data: profile } = useQuery({
    queryKey: ["bento-profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("creator_roles, headline")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  const { data: offerings } = useQuery({
    queryKey: ["bento-offerings", userId],
    queryFn: async () => {
      const { data } = await supabase.from("marketplace_listings")
        .select("id, title, price, currency, credits_price")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(4);
      return data ?? [];
    },
    enabled: !!userId,
  });

  // Collaborators — followers/following count as a rough signal
  const { data: collabs } = useQuery({
    queryKey: ["bento-collabs", userId],
    queryFn: async () => {
      const { data: rows } = await supabase.from("project_collaborators")
        .select("user_id, projects!inner(user_id)")
        .eq("projects.user_id", userId);
      const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id).filter(Boolean)));
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", ids)
        .limit(8);
      return profs ?? [];
    },
    enabled: !!userId,
  });

  const featured = useMemo(() => projects?.[0], [projects]);
  const otherProjects = useMemo(() => (projects ?? []).slice(1, 5), [projects]);
  // Flow strip prefers works with covers; falls back to flow items
  const strip = useMemo(() => {
    const list = (works ?? []).filter((w: any) => w.cover_url || w.thumbnail_url || w.file_url);
    if (list.length >= 4) return list.slice(0, 6);
    const legacy = (flowItems ?? []).map((f: any) => ({
      id: f.id,
      title: f.title,
      kind: f.category ?? "post",
      cover_url: f.file_url,
      _legacy: true,
    }));
    return [...list, ...legacy].slice(0, 6);
  }, [works, flowItems]);

  const positive = (metrics?.change24h ?? 0) >= 0;
  const changeStr = metrics?.change24h == null ? "—" : `${positive ? "+" : ""}${metrics.change24h.toFixed(1)}%`;

  return (
    <div className="kinetic-theme rounded-[32px] p-5 md:p-8 -mx-2 md:-mx-4 mt-6 relative overflow-hidden"
      style={{ background: "var(--kb-bg)" }}>
      {/* Ambient wash */}
      <div className="pointer-events-none absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-20 blur-[120px]"
        style={{ background: "radial-gradient(circle, var(--kb-accent) 0%, transparent 70%)" }} />

      <div className="relative grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[180px]">

        {/* Featured Release — 2x2 */}
        <FeaturedTile
          project={featured}
          isOwnProfile={isOwnProfile}
          displayName={displayName}
          onStart={onStartProject}
          onOpen={(id: string) => navigate(`/projects/${id}`)}
        />

        {/* Coin Panel — 1x2 */}
        <CoinTile
          token={primaryToken}
          metrics={metrics}
          positive={positive}
          changeStr={changeStr}
          isOwnProfile={isOwnProfile}
          onAttach={() => setLauncherOpen(true)}
        />

        {/* Backing / Reputation stat — 1x1 */}
        <div className="rounded-3xl p-6 border flex flex-col justify-between"
          style={{ background: "var(--kb-accent)", color: "var(--kb-bg)", borderColor: "transparent" }}>
          <span className="text-[10px] uppercase tracking-widest font-bold opacity-70">Collaborators</span>
          <div>
            <div className="kb-display text-4xl md:text-5xl">{collabs?.length ?? 0}</div>
            <div className="text-xs font-semibold opacity-80 mt-1">Building together</div>
          </div>
        </div>

        {/* Services — 1x2 */}
        <div className="row-span-2 rounded-3xl p-6 border flex flex-col"
          style={{ background: "var(--kb-surface)", borderColor: "var(--kb-border)" }}>
          <div className="flex items-start justify-between mb-4">
            <h3 className="kb-display text-xl">Services</h3>
            <Briefcase className="h-4 w-4" style={{ color: "var(--kb-fg-faint)" }} />
          </div>
          {(profile?.creator_roles ?? []).length === 0 && (offerings?.length ?? 0) === 0 ? (
            <p className="text-xs" style={{ color: "var(--kb-fg-faint)" }}>
              {isOwnProfile ? "Add roles in settings to surface what you offer." : "No services listed yet."}
            </p>
          ) : (
            <ul className="space-y-3 flex-1">
              {(profile?.creator_roles ?? []).slice(0, 4).map((role: string) => (
                <li key={role} className="flex items-center gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--kb-accent)" }} />
                  <span style={{ color: "var(--kb-fg-dim)" }}>{role}</span>
                </li>
              ))}
              {(offerings ?? []).map((o: any) => (
                <li key={o.id}
                  className="flex items-center gap-3 text-sm cursor-pointer hover:opacity-100 opacity-70 transition-opacity"
                  onClick={() => navigate(`/listings/${o.id}`)}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--kb-accent)" }} />
                  <span className="flex-1 truncate">{o.title}</span>
                  <span className="text-[10px]" style={{ color: "var(--kb-fg-faint)" }}>
                    {o.price ? `${o.currency ?? "USD"} ${o.price}` : o.credits_price ? `${o.credits_price} cr` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Flow strip — 2x1 (visual thumbnails, addresses the "sad text placeholders" gripe) */}
        <div className="md:col-span-2 rounded-3xl p-5 border"
          style={{ background: "var(--kb-surface)", borderColor: "var(--kb-border)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="kb-display text-lg">Flow</h3>
            <button
              type="button"
              onClick={() => navigate(`/flow?user=${userId}`)}
              className="text-[10px] uppercase tracking-widest font-bold inline-flex items-center gap-1 hover:opacity-70"
              style={{ color: "var(--kb-accent)" }}
            >
              Open Feed <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
          {strip.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs" style={{ color: "var(--kb-fg-faint)" }}>
              No posts yet
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-2">
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
                  {(w.kind === "video") && (
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

        {/* Other releases — 2x1 */}
        <div className="md:col-span-2 rounded-3xl p-5 border"
          style={{ background: "var(--kb-surface)", borderColor: "var(--kb-border)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="kb-display text-lg">Releases</h3>
            <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "var(--kb-fg-faint)" }}>
              {projects?.length ?? 0} total
            </span>
          </div>
          {(otherProjects.length === 0 && !featured) ? (
            <div className="h-full flex items-center justify-center flex-col gap-2 text-center text-xs" style={{ color: "var(--kb-fg-faint)" }}>
              <FolderKanban className="h-5 w-5" />
              <span>No releases yet</span>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {otherProjects.map((p: any) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="relative aspect-square rounded-lg overflow-hidden group text-left p-2 flex flex-col justify-end"
                  style={{ background: p.cover_color || "var(--kb-surface-2)" }}
                  title={p.title}
                >
                  {p.cover_image_url && (
                    <img src={p.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="relative text-[10px] font-bold text-white line-clamp-2 leading-tight">{p.title}</div>
                  {p.linked_token_ticker && (
                    <div className="relative mt-1 inline-flex items-center gap-1 text-[9px] font-mono font-bold"
                      style={{ color: "var(--kb-accent)" }}>
                      ${p.linked_token_ticker}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      {isOwnProfile && (
        <AttachCoinLauncher open={launcherOpen} onOpenChange={setLauncherOpen} />
      )}
    </div>
  );
};

const FeaturedTile = ({ project, isOwnProfile, displayName, onStart, onOpen }: any) => {
  if (!project) {
    return (
      <div className="md:col-span-2 md:row-span-2 rounded-3xl p-8 border flex flex-col justify-between overflow-hidden relative"
        style={{ background: "var(--kb-surface)", borderColor: "var(--kb-border)" }}>
        <div className="absolute inset-0 opacity-30"
          style={{ background: "radial-gradient(circle at 30% 20%, var(--kb-accent), transparent 60%)" }} />
        <div className="relative">
          <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "var(--kb-accent)" }}>
            Featured Release
          </span>
        </div>
        <div className="relative">
          <h2 className="kb-display text-4xl md:text-6xl leading-[0.9]">
            {isOwnProfile ? "Start your first release" : `${displayName} hasn't released yet`}
          </h2>
          {isOwnProfile && (
            <button
              type="button"
              onClick={onStart}
              className="mt-6 inline-flex items-center gap-2 kb-display px-6 py-3 rounded-2xl transition-transform hover:scale-105"
              style={{ background: "var(--kb-accent)", color: "var(--kb-bg)" }}
            >
              <Rocket className="h-4 w-4" /> Spin up a release
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(project.id)}
      className="md:col-span-2 md:row-span-2 rounded-3xl overflow-hidden border relative group text-left"
      style={{ background: project.cover_color || "var(--kb-surface)", borderColor: "var(--kb-border)" }}
    >
      {project.cover_image_url && (
        <img
          src={project.cover_image_url}
          alt={project.title}
          className="absolute inset-0 h-full w-full object-cover opacity-70 group-hover:scale-105 group-hover:opacity-90 transition-all duration-700"
        />
      )}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, var(--kb-bg), transparent 60%)" }} />
      <div className="relative h-full flex flex-col justify-between p-6 md:p-8">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full"
            style={{ background: "rgba(45,212,168,0.15)", color: "var(--kb-accent)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--kb-accent)" }} />
            Featured Release
          </span>
          <ArrowUpRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--kb-fg)" }} />
        </div>
        <div>
          <h2 className="kb-display text-3xl md:text-5xl leading-[0.9]">{project.title}</h2>
          {project.linked_token_ticker && (
            <div className="mt-3 kb-display text-lg" style={{ color: "var(--kb-accent)" }}>
              ${project.linked_token_ticker}
            </div>
          )}
          {project.description && !project.linked_token_ticker && (
            <p className="mt-3 text-sm max-w-md line-clamp-2" style={{ color: "var(--kb-fg-dim)" }}>
              {project.description}
            </p>
          )}
        </div>
      </div>
    </button>
  );
};

const CoinTile = ({ token, metrics, positive, changeStr, isOwnProfile, onAttach }: any) => {
  if (!token) {
    if (!isOwnProfile) {
      return (
        <div className="row-span-2 rounded-3xl p-6 border flex flex-col justify-center items-center text-center"
          style={{ background: "var(--kb-surface)", borderColor: "var(--kb-border)" }}>
          <Coins className="h-6 w-6 mb-3" style={{ color: "var(--kb-fg-faint)" }} />
          <p className="text-xs" style={{ color: "var(--kb-fg-faint)" }}>No coin yet</p>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={onAttach}
        className="row-span-2 rounded-3xl p-6 border flex flex-col justify-between text-left group transition-all hover:-translate-y-1"
        style={{ background: "var(--kb-surface)", borderColor: "var(--kb-border)" }}
      >
        <div>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors group-hover:bg-[var(--kb-accent)] group-hover:text-[var(--kb-bg)]"
            style={{ background: "rgba(45,212,168,0.15)", color: "var(--kb-accent)" }}>
            <Plus className="h-5 w-5" />
          </div>
          <h3 className="kb-display text-2xl">Attach a coin</h3>
          <p className="text-xs mt-2" style={{ color: "var(--kb-fg-dim)" }}>
            Link your pump.fun token to a release or track.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "var(--kb-accent)" }}>
          Launch flow →
        </span>
      </button>
    );
  }

  const pumpUrl = `https://pump.fun/coin/${token.mint_address}`;

  return (
    <a
      href={pumpUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="row-span-2 rounded-3xl p-6 border flex flex-col justify-between group relative overflow-hidden"
      style={{ background: "var(--kb-surface)", borderColor: "rgba(45,212,168,0.25)" }}
    >
      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-30"
        style={{ background: "var(--kb-accent)" }} />

      <div className="relative">
        <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold mb-4"
          style={{ color: "var(--kb-accent)" }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--kb-accent)" }} />
          Live · pump.fun
        </div>
        <div className="kb-display text-4xl">${token.ticker}</div>
        <div className="text-xs mt-1 truncate" style={{ color: "var(--kb-fg-dim)" }}>{token.name}</div>
      </div>

      <div className="relative space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--kb-fg-faint)" }}>Price</div>
            <div className="kb-display text-2xl" style={{ color: "var(--kb-accent)" }}>{fmtUsdCompact(metrics?.priceUsd ?? null)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--kb-fg-faint)" }}>24h</div>
            <div className="text-sm font-bold inline-flex items-center gap-1"
              style={{ color: positive ? "var(--kb-accent)" : "#ef4444" }}>
              {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {changeStr}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t" style={{ borderColor: "var(--kb-border)" }}>
          <div>
            <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--kb-fg-faint)" }}>MC</div>
            <div className="text-sm font-bold" style={{ color: "var(--kb-fg)" }}>{fmtUsdCompact(metrics?.marketCapUsd ?? null)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--kb-fg-faint)" }}>Holders</div>
            <div className="text-sm font-bold" style={{ color: "var(--kb-fg)" }}>{fmtCount(metrics?.holderCount ?? null)}</div>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold group-hover:gap-2 transition-all"
          style={{ color: "var(--kb-accent)" }}>
          Trade <ExternalLink className="h-3 w-3" />
        </div>
      </div>
    </a>
  );
};

export default ProfileBentoCanvas;
