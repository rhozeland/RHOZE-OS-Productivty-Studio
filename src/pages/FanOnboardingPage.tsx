/**
 * FanOnboardingPage — 3-screen fan onboarding flow.
 *
 * Triggered after a user selects "Fan" on the role selection screen.
 * Uses only existing visual tokens — Button, ambient gradient, semantic
 * colors, glassmorphic card surfaces. Every screen is a full-screen modal
 * overlay with a thin progress line at the very top that fills as the user
 * advances.
 *
 * Screens:
 *   1. Hook            — headline + single CTA
 *   2. Wallet          — Phantom / Solflare connect (optional, skippable)
 *   3. Personalization — genre chips (≥1) + artist search → /discover
 *
 * Wallet connection persists via the SolanaWalletAdapter autoConnect storage.
 * Genre picks persist to localStorage AND to profiles.flow_preferred_categories.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, X, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";

const GENRES = [
  "Hip Hop", "R&B", "Pop", "Electronic", "Afrobeats", "Jazz", "Rock",
  "Indie", "Latin", "Gospel", "Dancehall", "Classical", "Soul", "Trap", "House",
];

const MAX_GENRES = 3;
const TOTAL_SCREENS = 3;
const DRAFT_KEY = "rhozeland.fan-onboarding.draft";

type Draft = {
  step?: number;
  genres?: string[];
};

const loadDraft = (): Draft => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "{}") as Draft;
  } catch {
    return {};
  }
};

const FanOnboardingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const draft = useMemo(loadDraft, []);
  const walletModal = useWalletModal();
  const { connected, publicKey, select, wallets } = useWallet();

  const [step, setStep] = useState<number>(draft.step ?? 0);
  const [genres, setGenres] = useState<string[]>(draft.genres ?? []);
  const [artistSearch, setArtistSearch] = useState("");
  const [finishing, setFinishing] = useState(false);

  // Persist draft
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ step, genres } satisfies Draft),
      );
    } catch {
      // ignore
    }
  }, [step, genres]);

  const progressPct = ((step + 1) / TOTAL_SCREENS) * 100;

  const goNext = () => setStep((s) => Math.min(TOTAL_SCREENS - 1, s + 1));
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const handleClose = () => {
    navigate("/discover", { replace: true });
  };

  const toggleGenre = (g: string) => {
    setGenres((prev) => {
      if (prev.includes(g)) return prev.filter((x) => x !== g);
      if (prev.length >= MAX_GENRES) {
        toast.message(`Pick up to ${MAX_GENRES} genres`);
        return prev;
      }
      return [...prev, g];
    });
  };

  const connectWallet = (name: "Phantom" | "Solflare") => {
    const found = wallets.find(
      (w) => w.adapter.name.toLowerCase() === name.toLowerCase(),
    );
    if (found) select(found.adapter.name);
    walletModal.setVisible(true);
  };

  const persistAndExit = async (target: string) => {
    if (finishing) return;
    setFinishing(true);
    try {
      if (user) {
        const patch: Record<string, any> = {
          user_type: "fan",
          flow_preferred_categories: genres,
          onboarding_completed_at: new Date().toISOString(),
        };
        await supabase.from("profiles").update(patch as any).eq("user_id", user.id);
      }
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(DRAFT_KEY);
      }
      navigate(target, { replace: true });
    } catch (err) {
      console.error(err);
      navigate("/discover", { replace: true });
    } finally {
      setFinishing(false);
    }
  };

  const finish = async () => {
    const params = new URLSearchParams();
    if (genres.length) params.set("genres", genres.join(","));
    if (artistSearch.trim()) params.set("q", artistSearch.trim());
    const qs = params.toString();
    await persistAndExit(qs ? `/discover?${qs}` : "/discover");
  };

  // Phantom official ghost mark (simplified, brand-accurate purple).
  const PhantomLogo = () => (
    <span className="w-10 h-10 rounded-xl bg-[#AB9FF2] flex items-center justify-center shrink-0">
      <svg viewBox="0 0 128 128" className="w-7 h-7" aria-hidden>
        <path
          fill="#fff"
          d="M110.6 64.9c0-25.7-20.8-46.5-46.6-46.5S17.5 39.2 17.5 64.9v44.7c0 1.4 1.1 2.5 2.5 2.5h22.6c1.4 0 2.5-1.1 2.5-2.5V94.4c0-1.7 2.1-2.5 3.3-1.3 7.4 7.4 17.7 12.1 29 12.1 1.7 0 3.3-.1 4.9-.3.9-.1 1.6.6 1.6 1.5v3.2c0 1.4 1.1 2.5 2.5 2.5h21.5c1.4 0 2.5-1.1 2.5-2.5V64.9zM52.8 76.1c-4.1 0-7.5-5-7.5-11.2s3.4-11.2 7.5-11.2 7.5 5 7.5 11.2-3.3 11.2-7.5 11.2zm26.8 0c-4.1 0-7.5-5-7.5-11.2s3.4-11.2 7.5-11.2 7.5 5 7.5 11.2-3.3 11.2-7.5 11.2z"
        />
      </svg>
    </span>
  );

  // Solflare official sun mark (simplified, brand-accurate orange→yellow gradient).
  const SolflareLogo = () => (
    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFC10B] to-[#FC7227] flex items-center justify-center shrink-0">
      <svg viewBox="0 0 64 64" className="w-7 h-7" aria-hidden>
        <circle cx="32" cy="32" r="11" fill="#fff" />
        <g fill="#fff">
          <rect x="30" y="4" width="4" height="10" rx="2" />
          <rect x="30" y="50" width="4" height="10" rx="2" />
          <rect x="4" y="30" width="10" height="4" rx="2" />
          <rect x="50" y="30" width="10" height="4" rx="2" />
          <rect x="11" y="11" width="4" height="10" rx="2" transform="rotate(-45 13 16)" />
          <rect x="49" y="11" width="4" height="10" rx="2" transform="rotate(45 51 16)" />
          <rect x="11" y="43" width="4" height="10" rx="2" transform="rotate(45 13 48)" />
          <rect x="49" y="43" width="4" height="10" rx="2" transform="rotate(-45 51 48)" />
        </g>
      </svg>
    </span>
  );


  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      {/* Ambient gradient — same tokens as role-select / musician onboarding */}
      <div
        className="pointer-events-none fixed inset-0 animated-gradient"
        style={{
          background: `linear-gradient(135deg, hsl(280 65% 72% / 0.2) 0%, hsl(320 65% 62% / 0.15) 25%, hsl(30 75% 62% / 0.14) 50%, hsl(175 55% 52% / 0.12) 75%, hsl(280 65% 72% / 0.2) 100%)`,
          backgroundSize: "300% 300%",
        }}
      />

      {/* Thin progress line — fills as user advances */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-muted/40">
        <motion.div
          className="h-full bg-gradient-to-r from-primary via-fuchsia-500 to-amber-500"
          initial={false}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {/* Back (screens 2–3) */}
      {step > 0 && (
        <button
          onClick={goBack}
          aria-label="Back"
          className="fixed top-4 left-4 z-50 rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}

      {/* Close — every screen */}
      <button
        onClick={handleClose}
        aria-label="Close"
        className="fixed top-4 right-4 z-50 rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait">
            {/* ─────────────────────── SCREEN 1 — Hook ─────────────────────── */}
            {step === 0 && (
              <motion.div
                key="s1"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="text-center"
              >
                <h1 className="font-display text-3xl sm:text-5xl font-bold text-foreground leading-tight mb-5">
                  Get a closer look at{" "}
                  <span className="bg-gradient-to-r from-primary via-fuchsia-500 to-amber-500 bg-clip-text text-transparent">
                    the music
                  </span>
                </h1>
                <p className="text-base sm:text-lg text-muted-foreground max-w-md mx-auto mb-10 leading-relaxed">
                  Join the inner circle. Discover unreleased tracks, behind-the-scenes content, and connect directly with artists.
                </p>
                <Button
                  onClick={goNext}
                  className="rounded-xl h-12 w-full font-semibold gap-1.5 text-base"
                >
                  Let's go
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
            )}

            {/* ─────────────────────── SCREEN 2 — Wallet ─────────────────────── */}
            {step === 1 && (
              <motion.div
                key="s2"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl p-6 sm:p-8 text-center"
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground mb-3">
                  Connect your wallet
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2 leading-tight">
                  Back artists. Hold their coins. Earn as they grow.
                </h2>
                <p className="text-sm text-muted-foreground mb-7 max-w-sm mx-auto">
                  Connect your wallet to get the full Rhozeland experience.
                </p>

                {connected && publicKey ? (
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-500">
                      <Check className="w-4 h-4" strokeWidth={3} />
                      Wallet connected
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {publicKey.toBase58().slice(0, 6)}…{publicKey.toBase58().slice(-6)}
                    </p>
                    <Button
                      onClick={goNext}
                      className="rounded-xl h-12 w-full font-semibold gap-1.5 text-base"
                    >
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => connectWallet("Phantom")}
                      className="w-full inline-flex items-center gap-3 rounded-xl border border-border bg-background/60 hover:bg-background transition-colors px-4 py-3.5 text-left"
                    >
                      <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-white text-base font-bold shrink-0">
                        P
                      </span>
                      <span className="text-base font-bold text-foreground flex-1">Connect Phantom</span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      onClick={() => connectWallet("Solflare")}
                      className="w-full inline-flex items-center gap-3 rounded-xl border border-border bg-background/60 hover:bg-background transition-colors px-4 py-3.5 text-left"
                    >
                      <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-base font-bold shrink-0">
                        S
                      </span>
                      <span className="text-base font-bold text-foreground flex-1">Connect Solflare</span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <p className="text-[11px] text-muted-foreground pt-1">
                      Your wallet is never shared and stays fully in your control.
                    </p>
                    <button
                      type="button"
                      onClick={goNext}
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors pt-3"
                    >
                      Skip for now — I'll connect later
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* ─────────────────────── SCREEN 3 — Personalization ─────────────────────── */}
            {step === 2 && (
              <motion.div
                key="s3"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl p-6 sm:p-8"
              >
                <h2 className="text-center font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">
                  What are you into?
                </h2>
                <p className="text-center text-sm text-muted-foreground mb-6">
                  Pick up to {MAX_GENRES} genres to build your feed.
                </p>

                <div className="flex flex-wrap gap-2 justify-center mb-6">
                  {GENRES.map((g) => {
                    const active = genres.includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleGenre(g)}
                        className={`rounded-full px-4 py-2 text-sm font-medium border transition-all ${
                          active
                            ? "bg-foreground text-background border-foreground shadow-sm"
                            : "bg-background/60 text-foreground border-border hover:bg-background"
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>

                <div className="relative mb-6">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={artistSearch}
                    onChange={(e) => setArtistSearch(e.target.value)}
                    placeholder="Or search for a specific artist..."
                    className="rounded-xl h-11 pl-9"
                  />
                </div>

                <Button
                  onClick={finish}
                  disabled={genres.length === 0 || finishing}
                  className="rounded-xl h-12 w-full font-semibold gap-1.5 text-base"
                >
                  Build my feed
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default FanOnboardingPage;
