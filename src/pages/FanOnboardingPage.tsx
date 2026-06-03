import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Check, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const GENRES = [
  { id: "rnb", emoji: "🎤", label: "R&B" },
  { id: "hiphop", emoji: "🎧", label: "Hip-Hop" },
  { id: "electronic", emoji: "🔊", label: "Electronic" },
  { id: "indie", emoji: "🪕", label: "Indie/Folk" },
  { id: "soul", emoji: "✨", label: "Soul" },
  { id: "visual", emoji: "🎨", label: "Visual Art" },
  { id: "jazz", emoji: "🎷", label: "Jazz" },
  { id: "afrobeats", emoji: "🥁", label: "Afrobeats" },
  { id: "photography", emoji: "📷", label: "Photography" },
  { id: "fashion", emoji: "👗", label: "Fashion" },
  { id: "3d", emoji: "🧊", label: "3D" },
  { id: "spoken", emoji: "🎙️", label: "Spoken Word" },
];

const POPULAR_CITIES = [
  "Toronto", "New York", "London", "Los Angeles", "Lagos", "Montreal", "Vancouver",
];

const MIN_GENRES = 3;

const FanOnboardingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [genres, setGenres] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleGenre = (id: string) => {
    setGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const filteredCities = cityQuery
    ? POPULAR_CITIES.filter((c) => c.toLowerCase().includes(cityQuery.toLowerCase()))
    : POPULAR_CITIES;

  const persist = async (extra: Record<string, any> = {}) => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({
        flow_preferred_categories: genres,
        ...(city ? { location: city } : {}),
        ...extra,
      } as any)
      .eq("user_id", user.id);
  };

  const finish = async (mode: "create" | "browse") => {
    if (!user) return;
    setSaving(true);
    try {
      await persist({ onboarding_completed_at: new Date().toISOString() });
      toast.success("Your feed is ready 🎉");
      navigate(mode === "browse" ? "/discover" : "/discover", { replace: true });
    } catch (err: any) {
      console.error(err);
      navigate("/discover", { replace: true });
    } finally {
      setSaving(false);
    }
  };

  // Persist genres as user picks (best-effort, silent).
  useEffect(() => {
    if (!user || step !== 1) return;
    (async () => {
      await supabase
        .from("profiles")
        .update({ flow_preferred_categories: genres } as any)
        .eq("user_id", user.id);
    })();
  }, [step, user]); // intentionally not depending on genres

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden px-4 py-10">
      <div
        className="pointer-events-none fixed inset-0 animated-gradient"
        style={{
          background: `linear-gradient(135deg, hsl(280 65% 72% / 0.2) 0%, hsl(320 65% 62% / 0.15) 25%, hsl(30 75% 62% / 0.14) 50%, hsl(175 55% 52% / 0.12) 75%, hsl(280 65% 72% / 0.2) 100%)`,
          backgroundSize: "300% 300%",
        }}
      />

      {/* 3 dots progress */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i <= step ? "bg-foreground w-8" : "bg-border w-4"
            }`}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-xl">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="genres"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl p-8 sm:p-10"
            >
              <div className="text-center mb-6">
                <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                  What do you vibe with?
                </h2>
                <p className="text-sm text-muted-foreground">
                  Pick at least {MIN_GENRES} so we can tune your feed.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {GENRES.map((g) => {
                  const active = genres.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGenre(g.id)}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-3 py-4 text-sm font-medium transition-all ${
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background/60 text-foreground hover:bg-background"
                      }`}
                    >
                      <span className="text-xl leading-none">{g.emoji}</span>
                      <span>{g.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {genres.length}/{MIN_GENRES} selected
                </span>
                <Button
                  onClick={() => setStep(1)}
                  disabled={genres.length < MIN_GENRES}
                  className="rounded-xl gap-1.5"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="city"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl p-8 sm:p-10"
            >
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/5 border border-border/50 mb-3">
                  <MapPin className="h-5 w-5 text-foreground/70" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                  Where are you discovering from?
                </h2>
                <p className="text-sm text-muted-foreground">
                  We'll surface scenes nearby first.
                </p>
              </div>

              <Input
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                placeholder="Search a city…"
                className="rounded-xl h-11"
              />

              <div className="mt-4 flex flex-wrap gap-2">
                {filteredCities.map((c) => {
                  const active = city === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCity(c)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background/60 text-foreground hover:bg-background"
                      }`}
                    >
                      {active && <Check className="w-3 h-3" />}
                      {c}
                    </button>
                  );
                })}
                {cityQuery && !filteredCities.includes(cityQuery) && (
                  <button
                    type="button"
                    onClick={() => setCity(cityQuery)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                      city === cityQuery
                        ? "border-foreground bg-foreground text-background"
                        : "border-dashed border-border bg-background/60 text-foreground hover:bg-background"
                    }`}
                  >
                    Use "{cityQuery}"
                  </button>
                )}
              </div>

              <div className="mt-8 flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep(0)} className="rounded-xl gap-1.5">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Skip
                  </button>
                  <Button onClick={() => setStep(2)} className="rounded-xl gap-1.5">
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl p-8 sm:p-10 text-center"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/5 border border-border/50 mb-4">
                <Sparkles className="h-5 w-5 text-foreground/70" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Your feed is ready
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                Save your picks and start backing musicians before they blow up.
              </p>

              {/* Blurred preview cards */}
              <div className="grid grid-cols-3 gap-2.5 mb-8">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.1 }}
                    className="aspect-[3/4] rounded-2xl border border-border/60 overflow-hidden relative"
                    style={{
                      background: `linear-gradient(135deg, hsl(${280 + i * 30} 60% 70% / 0.45), hsl(${30 + i * 20} 70% 65% / 0.35))`,
                    }}
                  >
                    <div className="absolute inset-0 backdrop-blur-md" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="h-2 rounded-full bg-foreground/30 mb-1.5 w-3/4" />
                      <div className="h-1.5 rounded-full bg-foreground/20 w-1/2" />
                    </div>
                  </motion.div>
                ))}
              </div>

              <Button
                onClick={() => finish("create")}
                disabled={saving}
                className="rounded-xl h-11 w-full font-semibold"
              >
                {saving ? "Setting up…" : "Enter Rhozeland"}
              </Button>
              <button
                type="button"
                onClick={() => finish("browse")}
                disabled={saving}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors mt-4"
              >
                Just browse first →
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FanOnboardingPage;
