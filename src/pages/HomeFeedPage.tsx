/**
 * HomeFeedPage — `/home` (v11)
 *
 * Logged-in front door. Three stacked sections, all inline (no redirects):
 *   1. CTA Carousel — auto-rotating gradient slider for the two primary
 *      actions: "Start a Project" and "Launch a Coin". Sized to match the
 *      Creator Pass card (~aspect 21:9 hero).
 *   2. Discover globe + featured carousel — living map of artists/events/spaces.
 *   3. Flow Mode — full feed embedded directly.
 */
import { Suspense, lazy, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, Coins, ArrowRight, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import FlowModePage from "@/pages/FlowModePage";
import { useDiscoverFeatured } from "@/components/discover/useDiscoverFeatured";
import type { RegionMarket } from "@/lib/regions";
import StartProjectPicker from "@/components/project/StartProjectPicker";

const DiscoverGlobe = lazy(() => import("@/components/discover/DiscoverGlobe"));

type Slide = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  Icon: typeof Rocket;
  gradient: string;
  href: string;
  onClick?: () => void;
};

const HomeFeedPage = () => {
  const navigate = useNavigate();
  const [marketFilter, setMarketFilter] = useState<RegionMarket | "All">("All");
  const { slides: featuredSlides } = useDiscoverFeatured(marketFilter);
  const [pickerOpen, setPickerOpen] = useState(false);

  const startProject = () => {
    setPickerOpen(true);
  };

  const ctaSlides: Slide[] = [
    {
      id: "project",
      eyebrow: "Build in public",
      title: "Start a Project",
      subtitle: "Plan a release. Share the roadmap. Let fans back the work as you ship it.",
      cta: "Start a Project",
      Icon: Rocket,
      gradient:
        "linear-gradient(135deg, hsl(330 85% 60%) 0%, hsl(292 84% 61%) 50%, hsl(38 92% 55%) 100%)",
      href: "#",
      onClick: startProject,
    },
    {
      id: "coin",
      eyebrow: "Get backed",
      title: "Launch a Coin",
      subtitle: "Spin up your artist token on pump.fun. Turn supporters into co-owners.",
      cta: "Launch a Coin",
      Icon: Coins,
      gradient:
        "linear-gradient(135deg, hsl(200 90% 55%) 0%, hsl(260 80% 60%) 50%, hsl(170 80% 50%) 100%)",
      href: "/studio?coin=1",
    },
  ];

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % ctaSlides.length), 6000);
    return () => clearInterval(t);
  }, [ctaSlides.length]);

  const slide = ctaSlides[idx];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-3 pb-12 space-y-8">
      {/* ─── 1. CTA Carousel ────────────────────────────────────────────── */}
      <section className="relative">
        <div className="relative w-full aspect-[21/9] sm:aspect-[24/9] rounded-3xl overflow-hidden shadow-[0_30px_80px_-30px_hsl(var(--foreground)/0.4)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id}
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0"
              style={{ backgroundImage: slide.gradient }}
            >
              {/* Animated shimmer */}
              <motion.div
                aria-hidden
                className="absolute inset-0 opacity-50"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 20% 30%, hsl(0 0% 100% / 0.25), transparent 40%), radial-gradient(circle at 80% 70%, hsl(0 0% 100% / 0.18), transparent 45%)",
                }}
                animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              />
              {/* Floating orbs */}
              <motion.div
                aria-hidden
                className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/20 blur-3xl"
                animate={{ y: [0, 20, 0], x: [0, -10, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                aria-hidden
                className="absolute -bottom-12 -left-12 h-56 w-56 rounded-full bg-white/15 blur-3xl"
                animate={{ y: [0, -16, 0], x: [0, 12, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Content */}
              <div className="relative h-full w-full p-5 sm:p-8 flex flex-col justify-between text-white">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-semibold">
                    <slide.Icon className="h-3 w-3" />
                    {slide.eyebrow}
                  </span>
                </div>

                <div className="space-y-2 sm:space-y-3 max-w-xl">
                  <h2 className="font-display text-2xl sm:text-4xl md:text-5xl font-bold leading-[1.05] drop-shadow-sm">
                    {slide.title}
                  </h2>
                  <p className="text-xs sm:text-sm md:text-base opacity-95 leading-snug max-w-md">
                    {slide.subtitle}
                  </p>
                  <button
                    type="button"
                    onClick={() => (slide.onClick ? slide.onClick() : navigate(slide.href))}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white text-foreground px-4 py-2 text-xs sm:text-sm font-semibold shadow-lg hover:scale-[1.03] active:scale-[0.98] transition-transform"
                  >
                    {slide.cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Arrows */}
          <button
            onClick={() => setIdx((i) => (i - 1 + ctaSlides.length) % ctaSlides.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/20 hover:bg-white/35 backdrop-blur-md text-white flex items-center justify-center transition"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % ctaSlides.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/20 hover:bg-white/35 backdrop-blur-md text-white flex items-center justify-center transition"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {ctaSlides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setIdx(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ─── 2. Live globe — featured worldwide ─────────────────────────── */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-0.5">
              Featured worldwide
            </p>
            <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">
              A living map of creative work
            </h2>
          </div>
        </div>
        <Suspense
          fallback={
            <div className="flex h-[380px] w-full items-center justify-center rounded-3xl border border-border/60 bg-card/40">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <DiscoverGlobe
            marketFilter={marketFilter}
            onSelectMarket={setMarketFilter}
            featuredSlides={featuredSlides}
            height={380}
          />
        </Suspense>
      </section>

      {/* ─── 3. Flow Mode — feed inline ─────────────────────────────────── */}
      <section className="pt-2">
        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-0.5">
            Fresh from the network
          </p>
          <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">
            Flow
          </h2>
        </div>
        {/*
          FlowModePage uses `-m-4 md:-m-8` + `min-h-[calc(100vh-3.5rem)]` to
          bleed into the app shell when mounted at /flow. We neutralize both
          here so the embedded version sits in its own rounded card matching
          the globe section above.
        */}
        <div className="relative rounded-3xl overflow-hidden border border-border/60 bg-card/40 h-[640px] sm:h-[720px]">
          <div className="absolute inset-0 p-4 md:p-8 overflow-hidden [&>div]:!min-h-full [&>div]:!m-0">
            <FlowModePage />
          </div>
        </div>
      </section>

      <StartProjectPicker open={pickerOpen} onOpenChange={setPickerOpen} />
    </div>
  );
};

export default HomeFeedPage;
