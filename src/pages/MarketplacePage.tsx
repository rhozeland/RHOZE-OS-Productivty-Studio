import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Flame, Briefcase, CalendarDays, Building2, LayoutGrid, ArrowRight, Search, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ConversationsMosaic, { type MosaicKindFilter } from "@/components/hub/ConversationsMosaic";
import CreateListingDialog from "@/components/marketplace/CreateListingDialog";

/**
 * MarketplacePage — restored as a first-class browsable mosaic.
 *
 * Reuses the unified ConversationsMosaic (Drops · Offerings · Events · Spaces)
 * so the visual language matches Discover, with a top "Open Flow" CTA that
 * jumps the user into the swipeable Flow Mode for a focused browse.
 */

const KIND_TABS: { key: MosaicKindFilter; label: string; Icon: typeof Sparkles }[] = [
  { key: "all", label: "Everything", Icon: LayoutGrid },
  { key: "drop", label: "Drops", Icon: Flame },
  { key: "offering", label: "Offerings", Icon: Briefcase },
  { key: "event", label: "Events", Icon: CalendarDays },
  { key: "space", label: "Spaces", Icon: Building2 },
];

const MarketplacePage = () => {
  const navigate = useNavigate();
  const [kind, setKind] = useState<MosaicKindFilter>("all");
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-1.5">
            Marketplace
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground leading-tight">
            Everything, all at once.
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
            Browse drops, offerings, events, and spaces from across Rhozeland — or
            jump into Flow for a focused, swipeable feed.
          </p>
        </div>
        <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={() => navigate("/flow")}
            className="rounded-full group shadow-md"
            size="lg"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Open Flow
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </motion.div>
      </div>

      {/* Search */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search drops, offerings, events, spaces..."
          className="pl-10 rounded-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Kind tabs */}
      <div className="flex flex-wrap gap-2">
        {KIND_TABS.map(({ key, label, Icon }) => {
          const isActive = kind === key;
          return (
            <button
              key={key}
              onClick={() => setKind(key)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all border ${
                isActive
                  ? "border-foreground/60 bg-foreground text-background shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Mosaic */}
      <ConversationsMosaic search={search} kind={kind} />
    </div>
  );
};

export default MarketplacePage;
