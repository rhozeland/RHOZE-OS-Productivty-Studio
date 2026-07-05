/**
 * AccessGatePage — v11.1 private-build gate.
 *
 * First screen every unauthenticated visitor sees. Two paths in:
 *  1. Access code (primary) — `redeem_access_code` RPC → localStorage flag.
 *  2. Waitlist email (fallback) — insert into `public.waitlist`.
 *
 * Everything else on the page is context: what Rhoze is, where Rhozeland
 * came from, what we're shipping, and the whitepaper preview. Signed-in
 * users skip entirely.
 */
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, ArrowRight, Check, ChevronDown, Fingerprint,
  Coins, Users, Sparkles, FileText, Play, Pause,
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
  { icon: Fingerprint, title: "Verified IP", desc: "Every upload fingerprinted with SHA-256 and anchored on-chain. Your work, provably yours." },
  { icon: Coins, title: "Attach your coin", desc: "Link a pump.fun token to your profile. Holders unlock private drops, DMs, and behind-the-scenes." },
  { icon: Sparkles, title: "$RHOZE rewards", desc: "Upload, comment, subscribe, discover — every action drips credits you can spend or hold." },
  { icon: Users, title: "Back projects", desc: "Fund a release, split revenue transparently, sign on-chain contracts. No labels, no middlemen." },
];

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

const AccessGatePage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"code" | "email" | null>(null);
  const [waitlisted, setWaitlisted] = useState(false);
  const [openPaper, setOpenPaper] = useState<number | null>(0);
  const [playing, setPlaying] = useState(false);

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
    try { window.localStorage.setItem(ACCESS_FLAG, "1"); } catch {}
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
    <div className="relative min-h-screen w-full bg-[#050505] text-white/90 overflow-x-hidden">
      {/* Aurora + grain background */}
      <div aria-hidden className="fixed inset-0 pointer-events-none">
        <motion.div
          animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
          transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-15%] left-[-15%] w-[70%] h-[70%] rounded-full bg-rose-500/20 blur-[140px]"
        />
        <motion.div
          animate={{ x: [0, -30, 40, 0], y: [0, 30, -20, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-15%] right-[-15%] w-[70%] h-[70%] rounded-full bg-fuchsia-500/20 blur-[140px]"
        />
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[30%] right-[15%] w-[40%] h-[50%] rounded-full bg-amber-500/10 blur-[120px]"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 6 }}
          className="absolute top-[10%] right-[40%] w-[35%] h-[40%] rounded-full bg-violet-500/15 blur-[120px]"
        />
        <div
          className="absolute inset-0 opacity-[0.08] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl px-6 pt-14 pb-24">
        {/* Wordmark */}
        <div className="flex items-center justify-center gap-2.5 mb-16">
          <img src={rhozelandLogo} alt="Rhoze" className="h-8 w-8" />
          <div className="flex flex-col leading-none">
            <span className="font-display text-lg tracking-tight text-white">Rhoze</span>
            <span className="text-[9px] uppercase tracking-[0.28em] text-white/40 mt-0.5">by Rhozeland</span>
          </div>
        </div>

        {/* Hero */}
        <div className="text-center mb-14 space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
            <span className="text-[10px] uppercase tracking-[0.22em] text-white/60">Private build · Summer 2026</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl italic tracking-tight leading-[1.02] text-white">
            A home for music<br />that owns itself.
          </h1>
          <p className="text-sm md:text-base text-white/50 max-w-md mx-auto leading-relaxed">
            Rhoze is our first product built for musicians — a place to prove your work, attach your economy, and let the people who love it own a piece.
          </p>
        </div>

        {/* Access forms — hero placement */}
        <div className="space-y-4 mb-20">
          <form onSubmit={submitCode} className="space-y-2">
            <label className="block text-[10px] uppercase tracking-[0.22em] text-white/40 ml-1">
              Insider access
            </label>
            <div className="relative group">
              <div className="absolute -inset-px rounded-lg bg-gradient-to-r from-rose-500/30 via-fuchsia-500/30 to-amber-500/30 opacity-0 group-focus-within:opacity-100 transition-opacity blur-sm" />
              <div className="relative">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter access code"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg py-4 pl-5 pr-28 text-sm placeholder:text-white/25 focus:outline-none focus:border-white/30 focus:bg-white/[0.07] transition-all font-light tracking-wide"
                />
                <button
                  type="submit"
                  disabled={!code.trim() || busy !== null}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-md bg-white text-black text-xs uppercase tracking-[0.15em] font-medium hover:bg-white/90 transition-all flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {busy === "code" ? <Loader2 className="h-3 w-3 animate-spin" /> : <>Enter <ArrowRight className="h-3 w-3" /></>}
                </button>
              </div>
            </div>
          </form>

          <form onSubmit={submitEmail} className="space-y-2">
            <label className="block text-[10px] uppercase tracking-[0.22em] text-white/40 ml-1">
              Or join the waitlist
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={waitlisted ? "You're on the list — talk soon." : "your@email.com"}
                disabled={waitlisted}
                className="w-full bg-transparent border border-white/[0.08] rounded-lg py-4 pl-5 pr-28 text-sm placeholder:text-white/25 focus:outline-none focus:border-white/20 transition-all font-light disabled:opacity-70"
              />
              <button
                type="submit"
                disabled={!email.trim() || busy !== null || waitlisted}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs uppercase tracking-[0.15em] text-white/40 hover:text-white/80 transition-colors flex items-center gap-1 disabled:opacity-40"
              >
                {busy === "email" ? <Loader2 className="h-3 w-3 animate-spin" />
                  : waitlisted ? <Check className="h-3 w-3 text-emerald-400" />
                  : "Submit"}
              </button>
            </div>
          </form>

          <div className="pt-2 text-center">
            <button
              onClick={() => navigate("/auth")}
              className="text-[10px] uppercase tracking-[0.25em] text-white/30 hover:text-white/60 transition-colors"
            >
              Already have an account? Sign in
            </button>
          </div>
        </div>

        {/* Visual centerpiece: rotating vinyl + demo hint */}
        <div className="relative mb-24 flex flex-col items-center">
          <div className="relative w-56 h-56 flex items-center justify-center">
            <motion.div
              animate={{ rotate: playing ? 360 : 0 }}
              transition={{ duration: 6, repeat: playing ? Infinity : 0, ease: "linear" }}
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "repeating-radial-gradient(circle at center, rgba(255,255,255,0.06) 0 2px, transparent 2px 4px), radial-gradient(circle at 30% 30%, hsl(330 70% 40%), hsl(280 60% 15%) 70%, #000 100%)",
                boxShadow: "0 20px 60px -20px rgba(236,72,153,0.4), inset 0 0 40px rgba(0,0,0,0.6)",
              }}
            />
            <div className="absolute inset-[38%] rounded-full bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center">
              <img src={rhozelandLogo} alt="" className="h-6 w-6 opacity-90" />
            </div>
            <button
              onClick={() => setPlaying((p) => !p)}
              className="absolute -bottom-2 -right-2 h-12 w-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
              aria-label={playing ? "Pause" : "Play preview"}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>
          </div>
          <p className="mt-6 text-[11px] uppercase tracking-[0.25em] text-white/40 text-center">
            {playing ? "Now spinning · a taste of what's coming" : "Tap to preview the vibe"}
          </p>
        </div>

        {/* Lore / timeline */}
        <section className="mb-24">
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/40 mb-2">The lore</p>
            <h2 className="font-display text-2xl md:text-3xl italic text-white leading-tight">
              Ten years in the making.
            </h2>
          </div>
          <div className="space-y-6">
            {timeline.map((t, i) => (
              <motion.div
                key={t.year}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="grid grid-cols-[64px_1fr] gap-5 items-baseline"
              >
                <div className="font-display text-xl text-white/80 tracking-tight">{t.year}</div>
                <div className="border-l border-white/10 pl-5 pb-2">
                  <div className="text-sm text-white font-medium mb-1">{t.title}</div>
                  <div className="text-xs text-white/50 leading-relaxed">{t.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
          <p className="mt-8 text-xs text-white/40 leading-relaxed italic border-l-2 border-rose-400/40 pl-4">
            We got here because of the musicians and artists who backed us from day one. Rhoze is the platform they deserved all along.
          </p>
        </section>

        {/* Features */}
        <section className="mb-24">
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/40 mb-2">What's inside</p>
            <h2 className="font-display text-2xl md:text-3xl italic text-white leading-tight">
              Built for artists who ship.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="p-5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 transition-all"
              >
                <f.icon className="h-4 w-4 text-white/70 mb-3" />
                <div className="text-sm text-white font-medium mb-1.5">{f.title}</div>
                <div className="text-xs text-white/50 leading-relaxed">{f.desc}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Whitepaper — expandable */}
        <section className="mb-20">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-white/40 mb-2">Reading material</p>
              <h2 className="font-display text-2xl md:text-3xl italic text-white leading-tight">
                Whitepaper · v0.1
              </h2>
            </div>
            <FileText className="h-4 w-4 text-white/40" />
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden divide-y divide-white/5">
            {whitepaperSections.map((s, i) => {
              const open = openPaper === i;
              return (
                <div key={s.title}>
                  <button
                    onClick={() => setOpenPaper(open ? null : i)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
                  >
                    <span className="text-sm text-white/90 tracking-wide">{s.title}</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
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
                        <p className="px-5 pb-5 text-xs text-white/55 leading-relaxed max-w-prose">
                          {s.body}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[10px] uppercase tracking-[0.25em] text-white/30 text-center">
            Full paper drops with public beta
          </p>
        </section>

        <footer className="pt-8 border-t border-white/5 text-center space-y-2">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/30">
            Rhoze · by Rhozeland
          </p>
          <p className="text-[10px] text-white/20">
            Built quietly. Shipping soon.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default AccessGatePage;
