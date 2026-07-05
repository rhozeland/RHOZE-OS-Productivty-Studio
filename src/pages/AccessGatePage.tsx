/**
 * AccessGatePage — v11.4 private-build gate.
 *
 * First screen every unauthenticated visitor sees. Two paths in:
 *  1. Access code (primary) — `redeem_access_code` RPC → localStorage flag.
 *  2. Waitlist email (fallback) — insert into `public.waitlist`.
 *
 * "What's inside · A quick look" = 4 browser-chrome cards
 * (Discover / Verified IP / Attach Coin / Sign On-chain). Discover tiles play
 * REAL audio pulled from `works` uploads; music only plays when tapped.
 */
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, ArrowRight, Check, ChevronDown, Fingerprint,
  Coins, Users, Sparkles, FileText, Pause, Play,
} from "lucide-react";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

export const ACCESS_FLAG = "rhoze_access_ok";
export const hasGateAccess = () => {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(ACCESS_FLAG) === "1";
  } catch {
    return false;
  }
};

const timeline = [
  { year: "2016", title: "The origin", desc: "A circle of friends sharing music, art, and culture in Brooklyn basements." },
  { year: "2021", title: "The hub", desc: "A digital home connecting creators, projects, and the resources they needed to move." },
  { year: "2023", title: "The studio", desc: "A physical space to record, produce, and collaborate — proof the community was real." },
  { year: "2026", title: "Rhoze", desc: "Our first product built for musicians. A platform for the ones who got us here." },
];

const features = [
  { icon: Fingerprint, title: "Verified IP", desc: "SHA-256 fingerprint, anchored on-chain." },
  { icon: Coins, title: "Attach your coin", desc: "Link a pump.fun token. Holders unlock drops." },
  { icon: Sparkles, title: "$RHOZE rewards", desc: "Every action drips credits." },
  { icon: Users, title: "Back projects", desc: "Fund releases. Sign on-chain. No middlemen." },
];

/** Six named vibe tiles. Gradient + label are fixed; audio URL is hydrated
 *  from real `works` + `flow_items` uploads at mount time. */
const vibes = [
  { name: "Bloom",   bg: "linear-gradient(135deg,#f9a8d4,#c084fc)" },
  { name: "Sunrise", bg: "linear-gradient(135deg,#fcd34d,#fb7185)" },
  { name: "Drift",   bg: "linear-gradient(135deg,#a78bfa,#60a5fa)" },
  { name: "Peach",   bg: "linear-gradient(135deg,#fda4af,#fbbf24)" },
  { name: "Mint",    bg: "linear-gradient(135deg,#67e8f9,#a78bfa)" },
  { name: "Ember",   bg: "linear-gradient(135deg,#fda4af,#f97316)" },
];

const AUDIO_EXT = /\.(mp3|wav|flac|aac|m4a|ogg|opus)(\?|$)/i;

type PreviewTrack = { url: string; title: string };


const whitepaperSections = [
  {
    title: "01 · The Problem",
    body: "Streaming pays fractions of a cent. Labels take 80%. Fans have no stake in the artists they love. The music industry is the last major creative field where the people who make it and the people who love it own nothing.",
  },
  {
    title: "02 · The Thesis",
    body: "Ownership is the missing primitive. When artists own their IP, fans own upside, and every action on the platform accrues value back to the people who created it — culture compounds instead of extracting.",
  },
  {
    title: "03 · The Stack",
    body: "Supabase-backed core, Solana for provenance and payments, pump.fun for creator token markets. SHA-256 fingerprinting on every work. Signed on-chain contracts for every collaboration. Non-custodial by design.",
  },
  {
    title: "04 · The Economy",
    body: "$RHOZE is the platform currency — earned through participation, spent on features, held to unlock tier perks. Creator coins are launched on pump.fun; we surface them, we don't mint them. Platform fees scale down with tier (15% → 7%).",
  },
  {
    title: "05 · The Roadmap",
    body: "Q3 2026: private beta with 200 verified artists. Q4 2026: public waitlist opens, first live releases. Q1 2027: mobile app, native wallet, fiat on-ramp. Q2 2027: A&R program, artist-development studio, live events.",
  },
];

/** Tiny browser-chrome frame used by every "What's inside" mock. */
const Chrome = ({ path, badge, children }: { path: string; badge?: React.ReactNode; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-black/10 bg-white/75 backdrop-blur-sm shadow-sm overflow-hidden">
    <div className="flex items-center gap-2 px-3 py-2 border-b border-black/5 bg-white/60">
      <div className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-rose-300" />
        <span className="h-2 w-2 rounded-full bg-amber-300" />
        <span className="h-2 w-2 rounded-full bg-emerald-300" />
      </div>
      <span className="text-[10px] text-zinc-500/70 tracking-wide">{path}</span>
      {badge && <div className="ml-auto">{badge}</div>}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const AccessGatePage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"code" | "email" | null>(null);
  const [waitlisted, setWaitlisted] = useState(false);
  const [openPaper, setOpenPaper] = useState<number | null>(0);
  const [tracks, setTracks] = useState<(PreviewTrack | null)[]>(Array(6).fill(null));
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Hydrate the 6 tiles with real audio uploads (works + flow_items).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [worksRes, flowRes] = await Promise.all([
        supabase.from("works").select("title, file_url").not("file_url", "is", null).order("created_at", { ascending: false }).limit(40),
        supabase.from("flow_items").select("title, file_url").not("file_url", "is", null).order("created_at", { ascending: false }).limit(40),
      ]);
      if (cancelled) return;
      const rows = [
        ...((worksRes.data ?? []) as { title: string | null; file_url: string | null }[]),
        ...((flowRes.data ?? []) as { title: string | null; file_url: string | null }[]),
      ];
      const seen = new Set<string>();
      const picks: PreviewTrack[] = [];
      for (const r of rows) {
        const url = r.file_url;
        if (!url || !AUDIO_EXT.test(url) || seen.has(url)) continue;
        seen.add(url);
        picks.push({ url, title: r.title || "Untitled" });
        if (picks.length >= 6) break;
      }
      const filled: (PreviewTrack | null)[] = Array(6).fill(null);
      picks.forEach((p, i) => { filled[i] = p; });
      setTracks(filled);
    })();
    return () => { cancelled = true; };
  }, []);


  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setActiveIdx(null);
  };

  const playTile = (idx: number) => {
    if (activeIdx === idx) { stopAudio(); return; }
    const track = tracks[idx];
    if (!track) {
      toast({ title: "No preview yet", description: "This tile will play a real drop once artists start uploading." });
      return;
    }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    const el = new Audio(track.url);
    el.volume = 0.7;
    el.onended = () => setActiveIdx((cur) => (cur === idx ? null : cur));
    el.play().catch(() => toast({ title: "Couldn't play preview", variant: "destructive" }));
    audioRef.current = el;
    setActiveIdx(idx);
  };

  useEffect(() => () => stopAudio(), []);

  useEffect(() => {
    if (hasGateAccess()) navigate("/home", { replace: true });
  }, [navigate]);

  if (loading) return null;
  if (user) return <Navigate to="/home" replace />;

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy("code");
    const { data, error } = await supabase.rpc("redeem_access_code", { _code: code.trim() });
    setBusy(null);
    if (error || !data) {
      toast({ title: "Invalid code", description: "That access code isn't recognised.", variant: "destructive" });
      return;
    }
    try { window.localStorage.setItem(ACCESS_FLAG, "1"); } catch { /* noop */ }
    navigate("/home", { replace: true });
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean || busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    setBusy("email");
    const { error } = await supabase.from("waitlist").insert({ email: clean });
    setBusy(null);
    if (error && !`${error.message}`.toLowerCase().includes("duplicate")) {
      toast({ title: "Something went wrong", description: error.message, variant: "destructive" });
      return;
    }
    setWaitlisted(true);
    setEmail("");
  };

  return (
    <div className="relative min-h-screen w-full bg-[#f4f4f6] text-zinc-900/90 overflow-x-hidden">
      {/* Soft gradient wash */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{ background: "linear-gradient(180deg, #ffffff 0%, #f4f4f6 40%, #f0eef4 100%)" }}
      />

      {/* Aurora + grain background */}
      <div aria-hidden className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
          transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-15%] left-[-15%] w-[70%] h-[70%] rounded-full bg-rose-300/30 blur-[140px]"
        />
        <motion.div
          animate={{ x: [0, -30, 40, 0], y: [0, 30, -20, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-15%] right-[-15%] w-[70%] h-[70%] rounded-full bg-fuchsia-300/25 blur-[140px]"
        />
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[30%] right-[15%] w-[40%] h-[50%] rounded-full bg-amber-200/30 blur-[120px]"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 6 }}
          className="absolute top-[10%] right-[40%] w-[35%] h-[40%] rounded-full bg-violet-300/20 blur-[120px]"
        />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl px-6 pt-14 pb-24">
        {/* Wordmark */}
        <div className="flex items-center justify-center gap-2.5 mb-16">
          <img src={rhozelandLogo} alt="Rhoze" className="h-8 w-8" />
          <div className="flex flex-col leading-none">
            <span className="font-display text-lg tracking-tight text-zinc-900">Rhoze</span>
            <span className="text-[9px] uppercase tracking-[0.28em] text-zinc-500/60 mt-0.5">by Rhozeland</span>
          </div>
        </div>

        {/* Hero */}
        <div className="text-center mb-14 space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-black/10 bg-white/60 backdrop-blur-sm shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[10px] uppercase tracking-[0.22em] text-zinc-500/70">Private build · Summer 2026</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl italic tracking-tight leading-[1.02] text-zinc-900">
            A home for music<br />that owns itself.
          </h1>
          <p className="text-sm md:text-base text-zinc-500/70 max-w-md mx-auto leading-relaxed">
            Rhoze is our first product built for musicians — a place to prove your work, attach your economy, and let the people who love it own a piece.
          </p>
        </div>

        {/* Access forms */}
        <div className="space-y-4 mb-20">
          <form onSubmit={submitCode} className="space-y-2">
            <label className="block text-[10px] uppercase tracking-[0.22em] text-zinc-500/60 ml-1">Insider access</label>
            <div className="relative group">
              <div className="absolute -inset-px rounded-lg bg-gradient-to-r from-rose-400/30 via-fuchsia-400/30 to-amber-400/30 opacity-0 group-focus-within:opacity-100 transition-opacity blur-sm" />
              <div className="relative">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter access code"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full bg-white/70 border border-black/10 rounded-lg py-4 pl-5 pr-28 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-black/25 focus:bg-white transition-all font-light tracking-wide shadow-sm"
                />
                <button
                  type="submit"
                  disabled={!code.trim() || busy !== null}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-md bg-zinc-900 text-white text-xs uppercase tracking-[0.15em] font-medium hover:bg-zinc-800 transition-all flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {busy === "code" ? <Loader2 className="h-3 w-3 animate-spin" /> : <>Enter <ArrowRight className="h-3 w-3" /></>}
                </button>
              </div>
            </div>
          </form>

          <form onSubmit={submitEmail} className="space-y-2">
            <label className="block text-[10px] uppercase tracking-[0.22em] text-zinc-500/60 ml-1">Or join the waitlist</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={waitlisted ? "You're on the list — talk soon." : "your@email.com"}
                disabled={waitlisted}
                className="w-full bg-white/40 border border-black/[0.08] rounded-lg py-4 pl-5 pr-28 text-sm placeholder:text-zinc-400 focus:outline-none focus:border-black/20 focus:bg-white/70 transition-all font-light disabled:opacity-70 shadow-sm"
              />
              <button
                type="submit"
                disabled={!email.trim() || busy !== null || waitlisted}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs uppercase tracking-[0.15em] text-zinc-500/60 hover:text-zinc-900 transition-colors flex items-center gap-1 disabled:opacity-40"
              >
                {busy === "email" ? <Loader2 className="h-3 w-3 animate-spin" />
                  : waitlisted ? <Check className="h-3 w-3 text-emerald-600" />
                  : "Submit"}
              </button>
            </div>
          </form>

          <div className="pt-2 text-center">
            <button
              onClick={() => navigate("/auth")}
              className="text-[10px] uppercase tracking-[0.25em] text-zinc-500/50 hover:text-zinc-900 transition-colors"
            >
              Already have an account? Sign in
            </button>
          </div>
        </div>

        {/* Lore / timeline */}
        <section className="mb-20">
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500/60 mb-1.5">The lore</p>
            <h2 className="font-display text-xl md:text-2xl italic text-zinc-900 leading-tight">Ten years in the making.</h2>
          </div>
          <div className="space-y-3">
            {timeline.map((t, i) => (
              <motion.div
                key={t.year}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="grid grid-cols-[44px_1fr] gap-3 items-baseline"
              >
                <div className="font-display text-sm text-zinc-900/70 tracking-tight">{t.year}</div>
                <div className="border-l border-black/10 pl-3">
                  <span className="text-xs text-zinc-900 font-medium">{t.title}</span>
                  <span className="text-xs text-zinc-500/70"> — {t.desc}</span>
                </div>
              </motion.div>
            ))}
          </div>
          <p className="mt-5 text-[11px] text-zinc-500/60 leading-relaxed italic border-l-2 border-rose-400/40 pl-3">
            Built for the musicians and artists who backed us from day one.
          </p>
        </section>

        {/* What's inside — 4 browser-chrome mocks */}
        <section className="mb-24">
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500/60 mb-1.5">What's inside</p>
            <h2 className="font-display text-xl md:text-2xl italic text-zinc-900 leading-tight">A quick look.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* DISCOVER — tappable $RHZE tiles playing real audio */}
            <Chrome
              path="rhoze.app / discover"
              badge={
                <span className="text-[10px] uppercase tracking-[0.2em] text-rose-500 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" /> live
                </span>
              }
            >
              <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500/60 mb-3">Discover</p>
              <div className="grid grid-cols-3 gap-2">
                {vibes.map((v, i) => {
                  const isActive = activeIdx === i;
                  return (
                    <button
                      key={v.name}
                      type="button"
                      onClick={() => playTile(i)}
                      className="group relative aspect-square rounded-lg overflow-hidden shadow-sm border border-black/5 focus:outline-none focus:ring-2 focus:ring-rose-400/60"
                      style={{ background: v.bg }}
                      aria-label={isActive ? "Pause preview" : "Play preview"}
                    >
                      {/* Vinyl grooves — visible when playing */}
                      <motion.div
                        aria-hidden
                        animate={{ rotate: isActive ? 360 : 0, opacity: isActive ? 0.55 : 0 }}
                        transition={{
                          rotate: { duration: 8, repeat: isActive ? Infinity : 0, ease: "linear" },
                          opacity: { duration: 0.3 },
                        }}
                        className="absolute inset-0"
                        style={{
                          background:
                            "repeating-radial-gradient(circle at 50% 50%, rgba(0,0,0,0.35) 0 2px, transparent 2px 5px)",
                        }}
                      />
                      {/* Center Rhoze mark */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <motion.div
                          animate={{ scale: isActive ? [1, 1.06, 1] : 1 }}
                          transition={{ duration: 1.6, repeat: isActive ? Infinity : 0, ease: "easeInOut" }}
                          className="h-10 w-10 rounded-full bg-white/95 shadow-md flex items-center justify-center"
                        >
                          <img src={rhozelandLogo} alt="" className="h-5 w-5 opacity-90" />
                        </motion.div>
                      </div>
                      {/* Play / pause pill */}
                      <span className="absolute bottom-1.5 right-1.5 h-5 w-5 rounded-full bg-zinc-900/90 text-white flex items-center justify-center shadow">
                        {isActive ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5 ml-[1px]" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Chrome>

            {/* VERIFIED IP */}
            <Chrome path="rhoze.app / verified ip">
              <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500/60 mb-3">Verified IP</p>
              <div className="rounded-lg border border-black/10 bg-white/70 p-3 flex items-center gap-3">
                <div className="h-11 w-11 rounded-md shrink-0" style={{ background: "linear-gradient(135deg,#f0abfc,#f472b6)" }} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-zinc-900 truncate">midnight_bloom.wav</div>
                  <div className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5">
                    <Check className="h-2.5 w-2.5" /> Anchored · 0x7f…3a2c
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[10px] text-zinc-500/60 tracking-wide">
                SHA-256 · <span className="text-zinc-900/70">a9f3e2…b41d</span>
              </p>
            </Chrome>

            {/* ATTACH COIN */}
            <Chrome path="rhoze.app / attach coin">
              <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500/60 mb-3">Attach coin</p>
              <div className="rounded-lg border border-black/10 bg-amber-50/60 p-3">
                <div className="flex items-baseline justify-between">
                  <div className="text-sm font-semibold text-zinc-900">$BLOOM</div>
                  <div className="text-[11px] text-emerald-600 font-medium">+18.4%</div>
                </div>
                <div className="text-[10px] text-zinc-500/70 mt-0.5">MC $42.1k · 214 holders</div>
                <svg viewBox="0 0 120 30" className="mt-2 w-full h-6" aria-hidden>
                  <polyline
                    fill="none"
                    stroke="hsl(330 85% 55%)"
                    strokeWidth="1.5"
                    points="0,22 15,18 30,20 45,14 60,16 75,10 90,12 105,6 120,8"
                  />
                </svg>
              </div>
            </Chrome>

            {/* SIGN ON-CHAIN */}
            <Chrome path="rhoze.app / contracts">
              <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500/60 mb-3">Sign on-chain</p>
              <div className="rounded-lg border border-black/10 bg-white/70 p-3">
                <div className="text-xs font-medium text-zinc-900">Release: Bloom EP</div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px]">You ✓</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px]">Producer ✓</span>
                </div>
                <div className="mt-2 text-[10px] text-zinc-500/70">Split 60 / 40 · escrow 2.4 SOL</div>
              </div>
            </Chrome>
          </div>

          {/* Feature legend */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-2">
                <f.icon className="h-3.5 w-3.5 text-zinc-900/60 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[11px] text-zinc-900 font-medium leading-tight">{f.title}</div>
                  <div className="text-[10px] text-zinc-500/70 leading-snug">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Whitepaper — expandable */}
        <section className="mb-20">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500/60 mb-2">Reading material</p>
              <h2 className="font-display text-2xl md:text-3xl italic text-zinc-900 leading-tight">Whitepaper · v0.1</h2>
            </div>
            <FileText className="h-4 w-4 text-zinc-900/40" />
          </div>
          <div className="rounded-xl border border-black/10 bg-white/50 overflow-hidden divide-y divide-black/5 shadow-sm">
            {whitepaperSections.map((s, i) => {
              const open = openPaper === i;
              return (
                <div key={s.title}>
                  <button
                    onClick={() => setOpenPaper(open ? null : i)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/70 transition-colors"
                  >
                    <span className="text-sm text-zinc-900/90 tracking-wide">{s.title}</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-zinc-500/50 transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 text-xs text-zinc-500/70 leading-relaxed max-w-prose">{s.body}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500/40 text-center">
            Full paper drops with public beta
          </p>
        </section>

        <footer className="pt-8 border-t border-black/5 text-center space-y-3">
          <p className="text-[11px] text-zinc-500/70">
            Looking for the label, press, or bookings?{" "}
            <a
              href="https://www.rhozeland.com"
              target="_blank"
              rel="noreferrer"
              className="text-zinc-900 underline underline-offset-4 decoration-rose-400/60 hover:decoration-rose-500 transition-colors"
            >
              Visit rhozeland.com →
            </a>
          </p>
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-900/40">Rhoze · by Rhozeland</p>
          <p className="text-[10px] text-zinc-500/40">Built quietly. Shipping soon.</p>
        </footer>
      </div>
    </div>
  );
};

export default AccessGatePage;
