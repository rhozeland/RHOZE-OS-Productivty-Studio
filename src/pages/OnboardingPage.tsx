import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Sparkles, Palette, Layout, Users, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoCustomizer } from "@/components/onboarding/LogoCustomizer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

const STEPS = [
  { id: "welcome", icon: Sparkles, title: "Welcome to Rhozeland" },
  { id: "logo", icon: Palette, title: "Create Your Toybox" },
  { id: "tour", icon: Layout, title: "Quick Tour" },
  { id: "ready", icon: CheckCircle2, title: "You're All Set" },
];

const TOUR_SLIDES = [
  {
    icon: Layout,
    title: "Your Dashboard",
    desc: "Your creative command center. Track projects, bookings, and everything at a glance.",
  },
  {
    icon: Users,
    title: "Creators Hub",
    desc: "Find talent, post jobs, offer services — connect with the creative community.",
  },
  {
    icon: Palette,
    title: "Smartboards",
    desc: "Visual collaboration boards for mood-setting, planning, and sharing ideas with your team.",
  },
];

const OnboardingPage = () => {
  const [step, setStep] = useState(0);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [tourSlide, setTourSlide] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showExportHint, setShowExportHint] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };
  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleLogoExport = (dataUrl: string) => {
    setLogoDataUrl(dataUrl);
    toast.success("Logo saved! You can always change it later.");
  };

  const finishOnboarding = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Save avatar if they made one
      if (logoDataUrl) {
        // Convert data URL to blob and upload
        const res = await fetch(logoDataUrl);
        const blob = await res.blob();
        const filePath = `${user.id}/avatar.png`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, blob, { upsert: true, contentType: "image/png" });

        if (!uploadError) {
          const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(filePath);
          await supabase
            .from("profiles")
            .update({ avatar_url: publicUrl.publicUrl })
            .eq("user_id", user.id);
        }
      }

      toast.success("Welcome aboard! 🎉");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error(err);
      navigate("/dashboard", { replace: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden">
      {/* Ambient background */}
      <div
        className="pointer-events-none fixed inset-0 animated-gradient"
        style={{
          background: `linear-gradient(135deg, hsl(280 65% 72% / 0.2) 0%, hsl(320 65% 62% / 0.15) 25%, hsl(30 75% 62% / 0.14) 50%, hsl(175 55% 52% / 0.12) 75%, hsl(280 65% 72% / 0.2) 100%)`,
          backgroundSize: "300% 300%",
        }}
      />

      {/* Step indicators */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i <= step ? "bg-foreground w-8" : "bg-border w-4"
            }`}
          />
        ))}
      </div>

      {/* Skip button */}
      <button
        onClick={() => navigate("/dashboard", { replace: true })}
        className="fixed top-6 right-6 z-20 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Skip for now
      </button>

      <div className="relative z-10 w-full max-w-lg mx-4">
        <AnimatePresence mode="wait">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="text-center"
            >
              <div className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl p-10 sm:p-14">
                {/* Rose-bloom logo animation */}
                <div className="relative inline-flex items-center justify-center w-28 h-28 mb-6">
                  {/* Petal rings that bloom outward */}
                  {[0, 1, 2, 3, 4].map((i) => (
                    <motion.div
                      key={`petal-${i}`}
                      initial={{ scale: 0, opacity: 0, rotate: i * 72 }}
                      animate={{
                        scale: [0, 1.2, 1],
                        opacity: [0, 0.6, 0.15],
                        rotate: i * 72 + 360,
                      }}
                      transition={{
                        duration: 2,
                        delay: 0.2 + i * 0.12,
                        ease: [0.16, 1, 0.3, 1],
                        rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                      }}
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `radial-gradient(ellipse at ${50 + Math.cos(i * 1.26) * 30}% ${50 + Math.sin(i * 1.26) * 30}%, hsl(${340 + i * 15} 60% 70% / 0.5), transparent 70%)`,
                      }}
                    />
                  ))}

                  {/* Inner glow */}
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 1.2, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-2 rounded-full"
                    style={{
                      background: "radial-gradient(circle, hsl(var(--primary) / 0.15), transparent 70%)",
                    }}
                  />

                  {/* Logo container with bloom-in */}
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 1.15, 1], opacity: 1 }}
                    transition={{
                      duration: 1,
                      delay: 0.4,
                      ease: [0.34, 1.56, 0.64, 1],
                    }}
                    className="relative z-10 w-16 h-16 rounded-2xl bg-card border border-border/50 shadow-lg flex items-center justify-center overflow-hidden"
                  >
                    <motion.img
                      src={rhozelandLogo}
                      alt="Rhozeland"
                      className="w-10 h-10 object-contain"
                      animate={{
                        scale: [1, 1.05, 1],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        repeatDelay: 1.5,
                        ease: "easeInOut",
                      }}
                    />
                  </motion.div>

                  {/* Sparkle particles */}
                  {[0, 1, 2, 3, 4, 5].map((i) => {
                    const angle = (i / 6) * Math.PI * 2;
                    const radius = 48;
                    return (
                      <motion.div
                        key={`sparkle-${i}`}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{
                          scale: [0, 1, 0],
                          opacity: [0, 1, 0],
                          x: Math.cos(angle) * radius,
                          y: Math.sin(angle) * radius,
                        }}
                        transition={{
                          duration: 1.5,
                          delay: 1 + i * 0.15,
                          repeat: Infinity,
                          repeatDelay: 3 + i * 0.3,
                        }}
                        className="absolute w-1.5 h-1.5 rounded-full bg-primary/60"
                      />
                    );
                  })}
                </div>

                <motion.h1
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="font-display text-3xl font-bold text-foreground mb-3"
                >
                  Welcome to Rhozeland
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1, duration: 0.6 }}
                  className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto mb-2"
                >
                  Your creative workspace is almost ready. Let's personalize your experience in a few quick steps.
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                  className="text-xs text-muted-foreground/60"
                >
                  Takes about 1 minute
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.4, duration: 0.5 }}
                >
                  <Button
                    onClick={next}
                    className="mt-8 rounded-xl h-12 px-8 font-semibold"
                  >
                    Let's Go
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Step 1: Logo Customizer */}
          {step === 1 && (
            <motion.div
              key="logo"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl p-8 sm:p-10">
                <div className="text-center mb-6">
                  <h2 className="font-display text-2xl font-bold text-foreground mb-1.5">
                    Create Your Toybox
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Tap each section of the logo and pick your colors. This becomes your profile icon.
                  </p>
                </div>

                <LogoCustomizer onExport={handleLogoExport} />

                {logoDataUrl && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center text-xs text-green-600 dark:text-green-400 mt-3"
                  >
                    ✓ Logo saved as profile picture
                  </motion.p>
                )}

                <div className="flex justify-between mt-8">
                  <Button variant="ghost" onClick={prev} className="rounded-xl gap-1.5">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </Button>
                  <Button
                    onClick={() => {
                      if (!logoDataUrl) {
                        setShowExportHint(true);
                        setTimeout(() => setShowExportHint(false), 4000);
                      }
                      next();
                    }}
                    className="rounded-xl gap-1.5"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* Export hint lightbox */}
                <AnimatePresence>
                  {showExportHint && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="mt-4 p-4 rounded-2xl border border-primary/20 bg-primary/5 backdrop-blur-sm text-center"
                    >
                      <p className="text-sm font-medium text-foreground mb-1">💡 Tip</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        You can tap <span className="font-semibold text-foreground">Export</span> anytime to download your Toybox logo — or update it later in Settings.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* Step 2: Quick Tour */}
          {step === 2 && (
            <motion.div
              key="tour"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl p-8 sm:p-10">
                <div className="text-center mb-8">
                  <h2 className="font-display text-2xl font-bold text-foreground mb-1.5">
                    Quick Tour
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Here's what you can do on Rhozeland
                  </p>
                </div>

                <div className="space-y-4">
                  {TOUR_SLIDES.map((slide, i) => {
                    const Icon = slide.icon;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.15 }}
                        className="flex items-start gap-4 p-4 rounded-2xl bg-secondary/30 border border-border/40"
                      >
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/5 border border-border/50 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">{slide.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{slide.desc}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="flex justify-between mt-8">
                  <Button variant="ghost" onClick={prev} className="rounded-xl gap-1.5">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </Button>
                  <Button onClick={next} className="rounded-xl gap-1.5">
                    Almost Done
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Ready */}
          {step === 3 && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="text-center"
            >
              <div className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl p-10 sm:p-14">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 mb-6"
                >
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </motion.div>
                <h2 className="font-display text-3xl font-bold text-foreground mb-3">
                  You're All Set!
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  Your workspace is ready. Start exploring projects, connecting with creators, and building something amazing.
                </p>

                <Button
                  onClick={finishOnboarding}
                  disabled={saving}
                  className="mt-8 rounded-xl h-12 px-8 font-semibold"
                >
                  {saving ? "Setting things up..." : "Enter Rhozeland"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <div className="flex justify-center mt-4">
                  <Button variant="ghost" onClick={prev} className="rounded-xl gap-1.5 text-xs">
                    <ArrowLeft className="w-3.5 h-3.5" /> Go Back
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default OnboardingPage;
