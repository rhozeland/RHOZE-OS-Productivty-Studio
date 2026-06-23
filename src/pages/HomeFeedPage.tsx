import { Suspense, lazy, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import FlowModePage from "@/pages/FlowModePage";
import { useDiscoverFeatured } from "@/components/discover/useDiscoverFeatured";
import type { RegionMarket } from "@/lib/regions";

const DiscoverGlobe = lazy(() => import("@/components/discover/DiscoverGlobe"));

const HomeFeedPage = () => {
  const [marketFilter, setMarketFilter] = useState<RegionMarket | "All">("All");
  const { slides: featuredSlides } = useDiscoverFeatured(marketFilter);

  return (
    <main className="min-h-[calc(100vh-3.5rem)] overflow-hidden bg-background">
      <section className="px-4 pb-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="overflow-hidden rounded-[2rem] border border-border/50 bg-card/30 shadow-[0_24px_80px_-48px_hsl(var(--foreground)/0.35)]"
          >
            <Suspense
              fallback={
                <div className="flex h-[420px] w-full items-center justify-center bg-card/40">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <DiscoverGlobe
                marketFilter={marketFilter}
                onSelectMarket={setMarketFilter}
                featuredSlides={featuredSlides}
                height={420}
              />
            </Suspense>
          </motion.div>
        </div>
      </section>

      <section className="px-0 pb-0 sm:px-4 lg:px-8">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-t-[2rem] border-x border-t border-border/40 bg-background/80 shadow-[0_-24px_80px_-56px_hsl(var(--foreground)/0.45)]">
          <div className="h-[calc(100vh-520px)] min-h-[560px]">
            <FlowModePage />
          </div>
        </div>
      </section>
    </main>
  );
};

export default HomeFeedPage;
