/**
 * MusicianOnboardingPage — 5-screen musician onboarding flow.
 *
 * Triggered after a user selects "Musician" on the role selection screen.
 * Uses only existing visual styles, gradient tokens, button/input/card
 * components, and the app's dark background. Every screen is a full-screen
 * modal overlay with a thin progress line at the very top that fills as the
 * user advances.
 *
 * Screens:
 *   1. The Promise   — hook + single CTA
 *   2. The Loop      — 3-step explainer
 *   3. Artist Profile — name / genre / city
 *   4. The Win       — Discover preview card + optional completion rows
 *   5. Activation    — Start a Project vs Post Something
 *
 * All inputs auto-save to localStorage so closing and reopening doesn't lose
 * progress. Final DB write happens when the user lands on screen 5 or
 * activates a CTA.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  X,
  Rocket,
  Users,
  Coins,
  Camera,
  Link as LinkIcon,
  Star,
  Wallet as WalletIcon,
  Music4,
  Sparkles,
  Plus,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import StartProjectPicker from "@/components/project/StartProjectPicker";

const GENRES = [
  "Hip Hop", "R&B", "Pop", "Electronic", "Afrobeats", "Jazz", "Rock",
  "Indie", "Latin", "Gospel", "Dancehall", "Classical", "Soul", "Trap", "House",
];

const EXPERIENCE_LEVELS = [
  "Just starting out",
  "Independent artist",
  "Signed artist",
  "Industry professional",
];

const SOCIAL_FIELDS = [
  { id: "instagram", label: "Instagram", col: "instagram_url", placeholder: "@yourhandle" },
  { id: "spotify", label: "Spotify", col: "spotify_url", placeholder: "Spotify artist link" },
  { id: "tiktok", label: "TikTok", col: "tiktok_url", placeholder: "@yourhandle" },
  { id: "soundcloud", label: "SoundCloud", col: "soundcloud_url", placeholder: "SoundCloud link" },
  { id: "youtube", label: "YouTube", col: "youtube_url", placeholder: "YouTube channel link" },
] as const;

const DRAFT_KEY = "rhozeland.musician-onboarding.draft";
const TOTAL_SCREENS = 5;

type Draft = {
  step?: number;
  displayName?: string;
  genre?: string;
  city?: string;
  experience?: string;
  socials?: Record<string, string>;
  avatarPreview?: string;
};

const loadDraft = (): Draft => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "{}") as Draft;
  } catch {
    return {};
  }
};

const MusicianOnboardingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const draft = useMemo(loadDraft, []);
  const walletModal = useWalletModal();
  const { connected, publicKey, select, wallets } = useWallet();

  const [step, setStep] = useState<number>(draft.step ?? 0);
  const [displayName, setDisplayName] = useState(draft.displayName ?? "");
  const [genre, setGenre] = useState(draft.genre ?? "");
  const [city, setCity] = useState(draft.city ?? "");
  const [experience, setExperience] = useState(draft.experience ?? "");
  const [socials, setSocials] = useState<Record<string, string>>(draft.socials ?? {});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(draft.avatarPreview ?? null);

  const [showSocials, setShowSocials] = useState(false);
  const [showWallets, setShowWallets] = useState(false);
  const [showStartProject, setShowStartProject] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Persist draft on every change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: Draft = {
      step,
      displayName,
      genre,
      city,
      experience,
      socials,
      avatarPreview: avatarPreview ?? undefined,
    };
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota errors (avatar preview can be large)
    }
  }, [step, displayName, genre, city, experience, socials, avatarPreview]);

  const progressPct = ((step + 1) / TOTAL_SCREENS) * 100;

  const goNext = () => setStep((s) => Math.min(TOTAL_SCREENS - 1, s + 1));
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const handleClose = () => {
    navigate("/discover", { replace: true });
  };

  const handleAvatar = (file: File) => {
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  /** Best-effort profile save — never blocks UI on failure. */
  const saveProfile = async () => {
    if (!user) return;
    try {
      if (avatarFile) {
        const path = `${user.id}/avatar.png`;
        const { error } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type || "image/png" });
        if (!error) {
          const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
          await supabase
            .from("profiles")
            .update({ avatar_url: pub.publicUrl } as any)
            .eq("user_id", user.id);
        }
      }
      const patch: Record<string, any> = {
        archetype: "musician",
        creator_roles: ["musician"],
      };
      if (displayName.trim()) patch.display_name = displayName.trim();
      if (city.trim()) patch.location = city.trim();
      if (genre) patch.mediums = [genre];
      for (const s of SOCIAL_FIELDS) {
        const v = (socials[s.id] || "").trim();
        if (v) patch[s.col] = v;
      }
      await supabase.from("profiles").update(patch as any).eq("user_id", user.id);
    } catch (err) {
      console.error("Onboarding save failed", err);
    }
  };

  const finishOnboarding = async (after: "project" | "post" | "done") => {
    if (finishing) return;
    setFinishing(true);
    try {
      await saveProfile();
      if (user) {
        await supabase
          .from("profiles")
          .update({ onboarding_completed_at: new Date().toISOString() } as any)
          .eq("user_id", user.id);
      }
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(DRAFT_KEY);
      }
      if (after === "project") {
        setShowStartProject(true);
        setFinishing(false);
        return;
      }
      if (after === "post") {
        navigate("/flow?share=1", { replace: true });
        return;
      }
      toast.success("You're on Rhozeland 🎉");
      navigate("/studio", { replace: true });
    } catch (err: any) {
      console.error(err);
      navigate("/discover", { replace: true });
    } finally {
      setFinishing(false);
    }
  };

  const connectWallet = (walletName: "Phantom" | "Solflare") => {
    const found = wallets.find((w) => w.adapter.name.toLowerCase() === walletName.toLowerCase());
    if (found) {
      select(found.adapter.name);
    }
    walletModal.setVisible(true);
  };

  // Auto-save profile patch when transitioning past screen 3
  useEffect(() => {
    if (step === 3) {
      saveProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      {/* Ambient gradient — same tokens as auth/role-select */}
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

      {/* Back (screens 2–5) */}
      {step > 0 && (
        <button
          onClick={goBack}
          aria-label="Back"
          className="fixed top-4 left-4 z-50 rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}

      {/* Close (every screen) */}
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
            {/* ────────────────────────  SCREEN 1 — Promise  ──────────────────────── */}
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
                  Your music is an asset.
                  <br />
                  <span className="bg-gradient-to-r from-primary via-fuchsia-500 to-amber-500 bg-clip-text text-transparent">
                    Start treating it like one.
                  </span>
                </h1>
                <p className="text-base sm:text-lg text-muted-foreground max-w-md mx-auto mb-10">
                  Build in public. Get backed by fans. Launch your coin on pump.fun.
                </p>
                <Button
                  onClick={goNext}
                  className="rounded-xl h-12 w-full font-semibold gap-1.5 text-base"
                >
                  Show me how
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
            )}

            {/* ────────────────────────  SCREEN 2 — Loop  ──────────────────────── */}
            {step === 1 && (
              <motion.div
                key="s2"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                <p className="text-center text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground mb-3">
                  Here's how it works
                </p>
                <h2 className="text-center font-display text-2xl sm:text-3xl font-bold text-foreground mb-10">
                  Three steps. One loop.
                </h2>

                <div className="relative">
                  {/* Connecting line */}
                  <div className="absolute left-6 top-6 bottom-6 w-px bg-gradient-to-b from-primary/60 via-fuchsia-500/40 to-amber-500/60" />
                  <ol className="space-y-5 relative">
                    {[
                      { n: "1", Icon: Rocket, title: "Start a project publicly", body: "Plan your next release in the open — fans see every step." },
                      { n: "2", Icon: Users, title: "Fans back your milestones", body: "They cheer, share, and tune in as you ship each beat." },
                      { n: "3", Icon: Coins, title: "Launch your coin. Get paid.", body: "When momentum hits, mint on pump.fun and reward early believers." },
                    ].map((s) => (
                      <li
                        key={s.n}
                        className="relative flex items-start gap-4 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-4 sm:p-5 shadow-sm"
                      >
                        <div className="relative shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 via-fuchsia-500/20 to-amber-500/20 border border-border/60 flex items-center justify-center">
                          <s.Icon className="w-5 h-5 text-foreground/80" />
                          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">
                            {s.n}
                          </span>
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <p className="font-display text-base font-bold text-foreground leading-tight mb-1">{s.title}</p>
                          <p className="text-sm text-muted-foreground leading-snug">{s.body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                <Button
                  onClick={goNext}
                  className="rounded-xl h-12 w-full font-semibold gap-1.5 text-base mt-10"
                >
                  I want this
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
            )}

            {/* ────────────────────────  SCREEN 3 — Profile  ──────────────────────── */}
            {step === 2 && (
              <motion.div
                key="s3"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl p-6 sm:p-8"
              >
                <p className="text-center text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground mb-2">
                  Let's set up your profile
                </p>
                <h2 className="text-center font-display text-2xl sm:text-3xl font-bold text-foreground mb-6">
                  Tell us about your sound
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Artist name
                    </label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your artist name"
                      className="rounded-xl h-11"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Genre
                    </label>
                    <Select value={genre} onValueChange={setGenre}>
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue placeholder="Pick a genre" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENRES.map((g) => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      City
                    </label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Where are you based?"
                      className="rounded-xl h-11"
                    />
                  </div>
                </div>

                <Button
                  onClick={goNext}
                  disabled={!displayName.trim() || !genre || !city.trim()}
                  className="rounded-xl h-12 w-full font-semibold gap-1.5 text-base mt-8"
                >
                  Build my profile
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
            )}

            {/* ────────────────────────  SCREEN 4 — The Win  ──────────────────────── */}
            {step === 3 && (
              <motion.div
                key="s4"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                <p className="text-center text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground mb-3">
                  Here's how you look on Discover
                </p>

                {/* Discover preview card — mirrors CreatorsGrid tile style */}
                <div className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-lg overflow-hidden mb-6 max-w-sm mx-auto">
                  <div
                    className="h-24 w-full"
                    style={{
                      background: `linear-gradient(135deg, hsl(280 65% 72% / 0.4), hsl(320 65% 62% / 0.35), hsl(30 75% 62% / 0.3))`,
                    }}
                  />
                  <div className="p-5 -mt-10">
                    <div className="w-16 h-16 rounded-full border-4 border-card overflow-hidden bg-muted/40 shadow-md">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Music4 className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <p className="font-display text-lg font-bold text-foreground mt-3 truncate">
                      {displayName || "Your name"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {[genre, city].filter(Boolean).join(" · ") || "Musician"}
                    </p>
                  </div>
                </div>

                <h2 className="text-center font-display text-2xl sm:text-3xl font-bold text-foreground mb-1">
                  Your profile is live.
                </h2>
                <p className="text-center text-sm text-muted-foreground mb-6">
                  Make it complete so fans can find you faster.
                </p>

                <div className="space-y-2.5">
                  {/* Row 1 — Photo */}
                  <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-3.5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-muted/60 border border-border/60 flex items-center justify-center shrink-0">
                      <Camera className="w-4 h-4 text-foreground/70" />
                    </div>
                    <span className="text-sm font-medium text-foreground flex-1">Add a profile photo</span>
                    <label className="inline-flex items-center gap-1 text-xs font-medium rounded-lg border border-border bg-background/60 px-3 py-1.5 cursor-pointer hover:bg-background transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleAvatar(f);
                        }}
                      />
                      {avatarPreview ? "Change" : "Add"}
                      <ArrowRight className="w-3 h-3" />
                    </label>
                  </div>

                  {/* Row 2 — Socials */}
                  <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-muted/60 border border-border/60 flex items-center justify-center shrink-0">
                        <LinkIcon className="w-4 h-4 text-foreground/70" />
                      </div>
                      <span className="text-sm font-medium text-foreground flex-1">Connect your socials</span>
                      <button
                        type="button"
                        onClick={() => setShowSocials((v) => !v)}
                        className="inline-flex items-center gap-1 text-xs font-medium rounded-lg border border-border bg-background/60 px-3 py-1.5 hover:bg-background transition-colors"
                      >
                        {showSocials ? "Hide" : "Connect"}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    {showSocials && (
                      <div className="mt-3 space-y-2 pl-12">
                        {SOCIAL_FIELDS.map((s) => (
                          <Input
                            key={s.id}
                            value={socials[s.id] || ""}
                            onChange={(e) =>
                              setSocials((prev) => ({ ...prev, [s.id]: e.target.value }))
                            }
                            placeholder={`${s.label} — ${s.placeholder}`}
                            className="rounded-lg h-10 text-sm"
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Row 3 — Experience */}
                  <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-3.5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-muted/60 border border-border/60 flex items-center justify-center shrink-0">
                      <Star className="w-4 h-4 text-foreground/70" />
                    </div>
                    <span className="text-sm font-medium text-foreground flex-1">Your experience level</span>
                    <div className="w-44">
                      <Select value={experience} onValueChange={setExperience}>
                        <SelectTrigger className="rounded-lg h-9 text-xs">
                          <SelectValue placeholder="Pick one" />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPERIENCE_LEVELS.map((l) => (
                            <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Row 4 — Wallet */}
                  <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-muted/60 border border-border/60 flex items-center justify-center shrink-0">
                        <WalletIcon className="w-4 h-4 text-foreground/70" />
                      </div>
                      <span className="text-sm font-medium text-foreground flex-1">
                        {connected && publicKey
                          ? `Wallet connected · ${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
                          : "Connect your wallet"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowWallets((v) => !v)}
                        className="inline-flex items-center gap-1 text-xs font-medium rounded-lg border border-border bg-background/60 px-3 py-1.5 hover:bg-background transition-colors"
                      >
                        {showWallets ? "Hide" : connected ? "Manage" : "Connect"}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    {showWallets && (
                      <div className="mt-3 space-y-2 pl-12">
                        <button
                          type="button"
                          onClick={() => connectWallet("Phantom")}
                          className="w-full inline-flex items-center gap-3 rounded-xl border border-border bg-background/60 hover:bg-background transition-colors px-4 py-3 text-left"
                        >
                          <PhantomLogo />
                          <span className="text-sm font-medium text-foreground flex-1">Connect Phantom</span>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button
                          type="button"
                          onClick={() => connectWallet("Solflare")}
                          className="w-full inline-flex items-center gap-3 rounded-xl border border-border bg-background/60 hover:bg-background transition-colors px-4 py-3 text-left"
                        >
                          <SolflareLogo />
                          <span className="text-sm font-medium text-foreground flex-1">Connect Solflare</span>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <p className="text-[11px] text-muted-foreground pt-1">
                          Your wallet lets you hold artist coins and claim $RHOZE. Optional — you can skip.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  onClick={goNext}
                  className="rounded-xl h-12 w-full font-semibold gap-1.5 text-base mt-6"
                >
                  Looks good
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <div className="text-center mt-3">
                  <button
                    type="button"
                    onClick={goNext}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Skip for now →
                  </button>
                </div>
              </motion.div>
            )}

            {/* ────────────────────────  SCREEN 5 — Activation  ──────────────────────── */}
            {step === 4 && (
              <motion.div
                key="s5"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                <h2 className="text-center font-display text-2xl sm:text-3xl font-bold text-foreground mb-1">
                  How do you want to start?
                </h2>
                <p className="text-center text-sm text-muted-foreground mb-8">
                  You can always do both later.
                </p>

                <div className="space-y-4">
                  {/* Hero — Start a Project */}
                  <div
                    className="relative overflow-hidden rounded-3xl p-6 shadow-xl border border-border/40"
                    style={{
                      background: `linear-gradient(135deg, hsl(330 81% 60%) 0%, hsl(320 75% 58%) 35%, hsl(20 90% 60%) 100%)`,
                    }}
                  >
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-background/20 backdrop-blur-sm border border-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white mb-4">
                      <Sparkles className="w-3 h-3" />
                      Build in public
                    </div>
                    <h3 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight mb-2">
                      Start a Project
                    </h3>
                    <p className="text-sm text-white/90 leading-relaxed mb-5 max-w-sm">
                      Plan a release. Get backed by fans. Launch your coin.
                    </p>
                    <Button
                      onClick={() => finishOnboarding("project")}
                      disabled={finishing}
                      className="rounded-xl h-11 w-full font-semibold gap-1.5 bg-white text-foreground hover:bg-white/90"
                    >
                      Start a Project
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Secondary — Post Something */}
                  <div className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-md p-5">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 border border-border/60 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                      <Upload className="w-3 h-3" />
                      Share your work
                    </div>
                    <h3 className="font-display text-xl font-bold text-foreground mb-1.5">
                      Drop Some Content
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      Share music, videos, or links to your feed.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => finishOnboarding("post")}
                      disabled={finishing}
                      className="rounded-xl h-11 w-full font-semibold gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Post Something
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Start a Project picker — opens after tapping the hero CTA */}
      <StartProjectPicker
        open={showStartProject}
        onOpenChange={(open) => {
          setShowStartProject(open);
          if (!open) {
            // Picker dismissed — drop the user into their studio.
            navigate("/studio", { replace: true });
          }
        }}
      />
    </div>
  );
};

export default MusicianOnboardingPage;
