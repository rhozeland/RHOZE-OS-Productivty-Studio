/**
 * FanOnboardingPage — 4-screen fan onboarding flow.
 * Screens: Hook → Profile Setup → Wallet → Personalization → /discover
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, X, Check, Search, Camera, Loader2, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const GENRES = [
  "Hip Hop", "R&B", "Pop", "Electronic", "Afrobeats", "Jazz", "Rock",
  "Indie", "Latin", "Gospel", "Dancehall", "Classical", "Soul", "Trap", "House",
];

const MAX_GENRES = 3;
const TOTAL_SCREENS = 4;
const DRAFT_KEY = "rhozeland.fan-onboarding.draft";

type Draft = {
  step?: number;
  displayName?: string;
  username?: string;
  city?: string;
  avatarUrl?: string;
  genres?: string[];
  artistSearch?: string;
};

const loadDraft = (): Draft => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "{}") as Draft;
  } catch {
    return {};
  }
};

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

const FanOnboardingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const draft = useMemo(loadDraft, []);
  const walletModal = useWalletModal();
  const { connected, publicKey, select, wallets } = useWallet();

  const [step, setStep] = useState<number>(draft.step ?? 0);
  const [displayName, setDisplayName] = useState(draft.displayName ?? "");
  const [username, setUsername] = useState(draft.username ?? "");
  const [city, setCity] = useState(draft.city ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string>(draft.avatarUrl ?? "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [genres, setGenres] = useState<string[]>(draft.genres ?? []);
  const [artistSearch, setArtistSearch] = useState(draft.artistSearch ?? "");
  const [finishing, setFinishing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // username availability
  const [debouncedUsername, setDebouncedUsername] = useState(username);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          step, displayName, username, city, avatarUrl, genres, artistSearch,
        } satisfies Draft),
      );
    } catch {}
  }, [step, displayName, username, city, avatarUrl, genres, artistSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedUsername(username), 350);
    return () => clearTimeout(t);
  }, [username]);

  useEffect(() => {
    const u = debouncedUsername.trim().toLowerCase();
    if (u.length < 3 || !/^[a-zA-Z0-9_]+$/.test(u)) {
      setUsernameAvailable(null);
      return;
    }
    let cancelled = false;
    setCheckingUsername(true);
    (async () => {
      const { data, error } = await supabase.rpc("check_username_available", { _username: u });
      if (cancelled) return;
      if (error) setUsernameAvailable(null);
      else setUsernameAvailable(Boolean(data));
      setCheckingUsername(false);
    })();
    return () => { cancelled = true; };
  }, [debouncedUsername]);

  const usernameClean = username.trim().toLowerCase();
  const usernameValid = usernameClean.length >= 3 && usernameClean.length <= 20 && /^[a-zA-Z0-9_]+$/.test(usernameClean);
  const profileCanSave = displayName.trim().length > 0 && usernameValid && usernameAvailable === true && !checkingUsername;

  const progressPct = (step / TOTAL_SCREENS) * 100;

  const goNext = () => setStep((s) => Math.min(TOTAL_SCREENS - 1, s + 1));
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const handleClose = () => {
    navigate("/discover", { replace: true });
  };

  const handleUsernameChange = (raw: string) => {
    // strip leading @ if user typed it, restrict chars
    const cleaned = raw.replace(/^@+/, "").replace(/[^a-zA-Z0-9_]/g, "");
    setUsername(cleaned);
  };

  const handleAvatarFile = async (file: File) => {
    if (!user) {
      toast.error("Sign in to upload a photo");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/onboarding-avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(`${urlData.publicUrl}?t=${Date.now()}`);
    } catch (e: any) {
      toast.error(e?.message || "Could not upload photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveProfileAndAdvance = async (opts?: { skip?: boolean }) => {
    if (savingProfile) return;
    if (!opts?.skip && !profileCanSave) return;
    setSavingProfile(true);
    try {
      if (user && !opts?.skip) {
        const patch: Record<string, any> = {
          display_name: displayName.trim(),
          username: usernameClean,
        };
        if (city.trim()) patch.location = city.trim();
        if (avatarUrl) patch.avatar_url = avatarUrl;
        const { error } = await supabase.from("profiles").update(patch as any).eq("user_id", user.id);
        if (error) throw error;
      }
      goNext();
    } catch (e: any) {
      toast.error(e?.message || "Could not save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleGenre = (genre: string) => {
    setGenres((prev) => {
      if (prev.includes(genre)) return prev.filter((value) => value !== genre);
      if (prev.length >= MAX_GENRES) {
        toast.message(`Pick up to ${MAX_GENRES} genres`);
        return prev;
      }
      return [...prev, genre];
    });
  };

  const connectWallet = (name: "Phantom" | "Solflare") => {
    const found = wallets.find((wallet) => wallet.adapter.name.toLowerCase() === name.toLowerCase());
    if (found) select(found.adapter.name);
    walletModal.setVisible(true);
  };

  const persistAndExit = async () => {
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
      const params = new URLSearchParams();
      if (genres.length) params.set("genres", genres.join(","));
      navigate(`/discover${params.toString() ? `?${params}` : ""}`, { replace: true });
    } catch (error) {
      console.error(error);
      navigate("/discover", { replace: true });
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div
        className="pointer-events-none fixed inset-0 animated-gradient"
        style={{
          background: `linear-gradient(135deg, hsl(280 65% 72% / 0.2) 0%, hsl(320 65% 62% / 0.15) 25%, hsl(30 75% 62% / 0.14) 50%, hsl(175 55% 52% / 0.12) 75%, hsl(280 65% 72% / 0.2) 100%)`,
          backgroundSize: "300% 300%",
        }}
      />

      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-muted/40">
        <motion.div
          className="h-full bg-gradient-to-r from-primary via-fuchsia-500 to-amber-500"
          initial={false}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {step > 0 && (
        <button
          onClick={goBack}
          aria-label="Back"
          className="fixed top-4 left-4 z-50 rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}

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
            {step === 0 && (
              <motion.div
                key="fan-hook"
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
                <Button onClick={goNext} className="rounded-xl h-12 w-full font-semibold gap-1.5 text-base">
                  Let's go
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="fan-profile"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl p-6 sm:p-8"
              >
                <p className="text-center text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground mb-3">
                  CREATE YOUR PROFILE
                </p>
                <h2 className="text-center font-display text-2xl sm:text-3xl font-bold text-foreground mb-6 leading-tight">
                  How should artists know you?
                </h2>

                <div className="space-y-5">
                  {/* Avatar */}
                  <div className="flex flex-col items-center">
                    <Label className="text-xs text-muted-foreground mb-2">Profile photo</Label>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="relative w-24 h-24 rounded-full border-2 border-dashed border-border hover:border-primary/60 bg-muted/40 overflow-hidden flex items-center justify-center transition-colors group"
                      aria-label="Upload profile photo"
                    >
                      {avatarUrl ? (
                        <>
                          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                          <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Camera className="w-5 h-5 text-white" />
                          </span>
                        </>
                      ) : uploadingAvatar ? (
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      ) : (
                        <Camera className="w-7 h-7 text-muted-foreground" />
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleAvatarFile(f);
                        e.target.value = "";
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {avatarUrl ? "Tap to change" : "Add a photo"}
                    </p>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setAvatarUrl("")}
                        className="text-[11px] text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1"
                      >
                        <XIcon className="w-3 h-3" /> Remove
                      </button>
                    )}
                  </div>

                  {/* Display name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="display-name">Display name</Label>
                    <Input
                      id="display-name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name or username"
                      maxLength={60}
                      className="rounded-xl h-11"
                    />
                  </div>

                  {/* Username */}
                  <div className="space-y-1.5">
                    <Label htmlFor="username">Username</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">@</span>
                      <Input
                        id="username"
                        value={username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        placeholder="handle"
                        maxLength={20}
                        className="rounded-xl h-11 pl-7 pr-10"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {checkingUsername && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                        {!checkingUsername && usernameValid && usernameAvailable === true && (
                          <Check className="w-4 h-4 text-emerald-500" />
                        )}
                        {!checkingUsername && usernameValid && usernameAvailable === false && (
                          <XIcon className="w-4 h-4 text-rose-500" />
                        )}
                      </div>
                    </div>
                    {username.length > 0 && !usernameValid && (
                      <p className="text-[11px] text-muted-foreground">3–20 letters, numbers, or underscores.</p>
                    )}
                    {usernameValid && usernameAvailable === false && (
                      <p className="text-[11px] text-rose-500 font-medium">That handle's taken.</p>
                    )}
                  </div>

                  {/* City */}
                  <div className="space-y-1.5">
                    <Label htmlFor="city">Your city <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Toronto, New York, Lagos..."
                      maxLength={80}
                      className="rounded-xl h-11"
                    />
                  </div>
                </div>

                <Button
                  onClick={() => saveProfileAndAdvance()}
                  disabled={!profileCanSave || savingProfile}
                  className="mt-6 rounded-xl h-12 w-full font-semibold gap-1.5 text-base"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : (<>Set up my profile <ArrowRight className="w-4 h-4" /></>)}
                </Button>
                <button
                  type="button"
                  onClick={() => saveProfileAndAdvance({ skip: true })}
                  className={cn(
                    "block mx-auto text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors pt-3",
                  )}
                >
                  Skip for now →
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="fan-wallet"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl p-6 sm:p-8 text-center"
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground mb-3">
                  CONNECT YOUR WALLET
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
                    <Button onClick={goNext} className="rounded-xl h-12 w-full font-semibold gap-1.5 text-base">
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
                      <PhantomLogo />
                      <span className="text-base font-bold text-foreground flex-1">Connect Phantom</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => connectWallet("Solflare")}
                      className="w-full inline-flex items-center gap-3 rounded-xl border border-border bg-background/60 hover:bg-background transition-colors px-4 py-3.5 text-left"
                    >
                      <SolflareLogo />
                      <span className="text-base font-bold text-foreground flex-1">Connect Solflare</span>
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

            {step === 3 && (
              <motion.div
                key="fan-personalization"
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
                  {GENRES.map((genre) => {
                    const active = genres.includes(genre);
                    return (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => toggleGenre(genre)}
                        className={`rounded-full px-4 py-2 text-sm font-medium border transition-all ${
                          active
                            ? "bg-foreground text-background border-foreground shadow-sm"
                            : "bg-background/60 text-foreground border-border hover:bg-background"
                        }`}
                      >
                        {genre}
                      </button>
                    );
                  })}
                </div>

                <div className="relative mb-6">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={artistSearch}
                    onChange={(event) => setArtistSearch(event.target.value)}
                    placeholder="Or search for a specific artist..."
                    className="rounded-xl h-11 pl-9"
                  />
                </div>

                <Button
                  onClick={persistAndExit}
                  disabled={genres.length === 0 || finishing}
                  className="rounded-xl h-12 w-full font-semibold gap-1.5 text-base"
                >
                  {finishing ? <Loader2 className="w-4 h-4 animate-spin" /> : (<>Build my feed <ArrowRight className="w-4 h-4" /></>)}
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
