/**
 * VerifiedIPHub — `/credits?tab=works` redesign.
 *
 * Shows three things:
 *  1. Eligibility strip: stats + quick-actions (Register a work, Anchor, Vault)
 *  2. **Your Flow drops** — Flow posts not yet linked to a Verified IP work,
 *     each promotable to Verified IP in one click (we hash the file_url and
 *     create a `works` row, then mirror the `work_id` back onto the flow item).
 *  3. **Your registered works** — recent works + Solscan links if anchored.
 *
 * Uploading a fresh file (not from Flow) reuses WorksPage's UploadDialog
 * flow, surfaced as a button that deep-links to `/works`.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield, ShieldCheck, Upload, Loader2, Fingerprint, Sparkles, ExternalLink, Music,
  Image as ImageIcon, Video, FileText, Flame,
} from "lucide-react";
import { toast } from "sonner";
import { computeContentHash, inferWorkKind } from "@/lib/content-hash";

type FlowItem = {
  id: string;
  user_id: string;
  title: string;
  category: string;
  content_type: string;
  file_url: string | null;
  link_url: string | null;
  content_hash: string | null;
  work_id: string | null;
  created_at: string;
};

type WorkRow = {
  id: string;
  title: string;
  kind: string;
  content_hash: string;
  solana_signature: string | null;
  created_at: string;
};

const KIND_ICONS: Record<string, typeof Music> = {
  audio: Music, image: ImageIcon, video: Video, text: FileText, other: Sparkles,
};

const VerifiedIPHub = ({ userId }: { userId: string | null }) => {
  const qc = useQueryClient();
  const [registeringId, setRegisteringId] = useState<string | null>(null);

  // Eligible Flow drops = mine, has a file_url, no work_id yet
  const { data: eligibleFlow = [], isLoading: loadingFlow } = useQuery({
    queryKey: ["flow-eligible-for-ip", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("flow_items")
        .select("id, user_id, title, category, content_type, file_url, link_url, content_hash, work_id, created_at")
        .eq("user_id", userId)
        .is("work_id", null)
        .not("file_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as FlowItem[];
    },
    enabled: !!userId,
  });

  // Recent works (registered IP)
  const { data: works = [], isLoading: loadingWorks } = useQuery({
    queryKey: ["my-works-ip", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("works")
        .select("id, title, kind, content_hash, solana_signature, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(6);
      return (data ?? []) as WorkRow[];
    },
    enabled: !!userId,
  });

  const stats = useMemo(() => ({
    fingerprinted: works.length,
    anchored: works.filter((w) => w.solana_signature).length,
    eligible: eligibleFlow.length,
  }), [works, eligibleFlow]);

  // Promote a Flow drop → Verified IP work
  const registerFromFlow = useMutation({
    mutationFn: async (item: FlowItem) => {
      if (!userId || !item.file_url) throw new Error("No file to register");
      setRegisteringId(item.id);

      // Pull the file bytes and hash in-browser (same shape as WorksPage upload)
      const res = await fetch(item.file_url);
      if (!res.ok) throw new Error(`Could not load file (${res.status})`);
      const blob = await res.blob();
      const file = new File([blob], item.title || "flow-drop", { type: blob.type });
      const hash = item.content_hash || (await computeContentHash(file));

      const kind = inferWorkKind(file);
      const { data: profile } = await supabase
        .from("profiles")
        .select("verification_status")
        .eq("user_id", userId)
        .maybeSingle();
      const isUnverified = profile?.verification_status !== "verified";

      const { data: work, error: insertErr } = await supabase
        .from("works")
        .insert({
          user_id: userId,
          title: item.title,
          kind,
          content_hash: hash,
          file_url: item.file_url,
          file_name: item.title,
          mime_type: blob.type || null,
          file_size: blob.size,
          visibility: "public",
          is_unverified: isUnverified,
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;

      // Link the flow item back to the new work
      const { error: linkErr } = await supabase
        .from("flow_items")
        .update({ work_id: work.id, content_hash: hash })
        .eq("id", item.id);
      if (linkErr) throw linkErr;

      return work.id;
    },
    onSuccess: () => {
      toast.success("Registered as Verified IP", {
        description: "Anchor it on Solana from your Works vault.",
      });
      qc.invalidateQueries({ queryKey: ["flow-eligible-for-ip"] });
      qc.invalidateQueries({ queryKey: ["my-works-ip"] });
      qc.invalidateQueries({ queryKey: ["works-mine"] });
    },
    onError: (err: any) => {
      toast.error("Could not register", { description: err?.message ?? "Unknown error" });
    },
    onSettled: () => setRegisteringId(null),
  });

  return (
    <div className="space-y-6">
      {/* ─── Hero / stats ─── */}
      <div className="surface-card p-5 sm:p-6">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
          <Shield className="h-3.5 w-3.5" /> Layer I · Verified IP
        </div>
        <h3 className="font-display text-2xl font-bold text-foreground">
          Every drop you make can be Verified IP.
        </h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          Flow drops, project files, anything you upload — Rhozeland computes a
          <strong className="text-foreground"> SHA-256 fingerprint</strong> in
          your browser, and you can anchor it on Solana for a public, timestamped
          proof of authorship.
        </p>
        <div className="grid sm:grid-cols-3 gap-3 mt-5">
          <StatTile label="Eligible from Flow" value={stats.eligible} accent="hsl(30 90% 60%)" icon={Flame} />
          <StatTile label="Fingerprinted" value={stats.fingerprinted} accent="hsl(280 70% 60%)" icon={Fingerprint} />
          <StatTile label="Anchored on Solana" value={stats.anchored} accent="hsl(140 60% 50%)" icon={ShieldCheck} />
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Link to="/works">
            <Button size="sm" className="rounded-full gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Upload new work
            </Button>
          </Link>
          <Link to="/works">
            <Button size="sm" variant="outline" className="rounded-full gap-1.5">
              Open the vault →
            </Button>
          </Link>
        </div>
      </div>

      {/* ─── Eligible Flow drops ─── */}
      <div className="surface-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-display text-base font-semibold text-foreground inline-flex items-center gap-2">
              <Flame className="h-4 w-4 text-primary" /> Your Flow drops
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              One click to promote a Flow post into your Verified IP vault.
            </p>
          </div>
        </div>

        {loadingFlow ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : eligibleFlow.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground">
              No eligible Flow drops right now.
            </p>
            <p className="text-[11px] text-muted-foreground">
              Post a file on Flow — it'll show up here, ready to register.
            </p>
            <Link to="/flow">
              <Button size="sm" variant="outline" className="rounded-full">
                Open Flow Mode
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {eligibleFlow.map((item) => {
              const Icon = KIND_ICONS[item.content_type] ?? Sparkles;
              const isRegistering = registeringId === item.id;
              return (
                <div
                  key={item.id}
                  className="group rounded-xl border border-border bg-background/40 overflow-hidden flex flex-col"
                >
                  <div className="aspect-square bg-muted/40 relative overflow-hidden">
                    {item.content_type === "image" && item.file_url ? (
                      <img src={item.file_url} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Icon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <Badge variant="secondary" className="absolute top-1.5 left-1.5 text-[10px] py-0 h-4 capitalize">
                      {item.content_type}
                    </Badge>
                  </div>
                  <div className="p-2.5 flex-1 flex flex-col gap-2">
                    <p className="text-xs font-medium text-foreground line-clamp-2 min-h-[2.4em]">
                      {item.title}
                    </p>
                    <Button
                      size="sm"
                      className="w-full h-7 text-[11px] rounded-full gap-1"
                      disabled={isRegistering || registerFromFlow.isPending}
                      onClick={() => registerFromFlow.mutate(item)}
                    >
                      {isRegistering ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Registering…</>
                      ) : (
                        <><Shield className="h-3 w-3" /> Register</>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Recent registered works ─── */}
      <div className="surface-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-display text-base font-semibold text-foreground inline-flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-primary" /> Recently registered
          </h4>
          <Link to="/works" className="text-xs text-muted-foreground hover:text-foreground">
            See all →
          </Link>
        </div>
        {loadingWorks ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : works.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No works registered yet — promote a Flow drop above or upload one fresh.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {works.map((w) => (
              <li key={w.id} className="flex items-center gap-3 py-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                  <Shield className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">{w.title}</p>
                    <Badge variant="outline" className="text-[10px] py-0 h-4 capitalize">{w.kind}</Badge>
                    {w.solana_signature && (
                      <Badge variant="outline" className="gap-1 text-[10px] py-0 h-4">
                        <ShieldCheck className="h-2.5 w-2.5" /> Anchored
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground truncate">
                    sha256:{w.content_hash?.slice(0, 10)}…{w.content_hash?.slice(-6)}
                  </p>
                </div>
                {w.solana_signature && (
                  <a
                    href={`https://solscan.io/tx/${w.solana_signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground text-xs inline-flex items-center gap-1"
                  >
                    Solscan <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const StatTile = ({
  label, value, accent, icon: Icon,
}: { label: string; value: number; accent: string; icon: typeof Music }) => (
  <div className="relative rounded-xl border border-border p-3 overflow-hidden">
    <div
      className="absolute -top-6 -right-6 h-16 w-16 rounded-full opacity-20 blur-xl"
      style={{ background: accent }}
    />
    <div className="flex items-center gap-1.5 mb-1">
      <Icon className="h-3 w-3" style={{ color: accent }} />
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
    <p className="font-display text-2xl font-bold text-foreground">{value}</p>
  </div>
);

export default VerifiedIPHub;
