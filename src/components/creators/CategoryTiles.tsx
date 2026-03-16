import { Music, Palette, Camera, Video, PenTool } from "lucide-react";
import { motion } from "framer-motion";

const CATEGORIES = [
  { key: "music", label: "Music & Audio", icon: Music, gradient: "from-purple-500/20 to-pink-500/20", accent: "hsl(280 60% 55%)", emoji: "🎵" },
  { key: "design", label: "Graphics & Design", icon: Palette, gradient: "from-teal-500/20 to-emerald-500/20", accent: "hsl(160 60% 50%)", emoji: "🎨" },
  { key: "photo", label: "Photography", icon: Camera, gradient: "from-amber-500/20 to-orange-500/20", accent: "hsl(35 90% 55%)", emoji: "📸" },
  { key: "video", label: "Video & Animation", icon: Video, gradient: "from-rose-500/20 to-red-500/20", accent: "hsl(340 70% 55%)", emoji: "🎬" },
  { key: "writing", label: "Writing & Copy", icon: PenTool, gradient: "from-blue-500/20 to-indigo-500/20", accent: "hsl(210 60% 55%)", emoji: "✍️" },
];

interface CategoryTilesProps {
  activeCategory: string;
  onSelect: (key: string) => void;
  listingCounts?: Record<string, number>;
}

const CategoryTiles = ({ activeCategory, onSelect, listingCounts }: CategoryTilesProps) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
    {CATEGORIES.map((cat, i) => {
      const Icon = cat.icon;
      const isActive = activeCategory === cat.key;
      const count = listingCounts?.[cat.key] ?? 0;
      return (
        <motion.button
          key={cat.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          onClick={() => onSelect(isActive ? "all" : cat.key)}
          className={`relative overflow-hidden rounded-2xl p-4 text-left transition-all group ${
            isActive
              ? "ring-2 ring-primary shadow-lg scale-[1.02]"
              : "hover:shadow-md hover:scale-[1.01]"
          }`}
          style={{
            background: isActive
              ? `linear-gradient(135deg, ${cat.accent}22, ${cat.accent}11)`
              : undefined,
          }}
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${cat.gradient} opacity-60`} />
          <div className="relative z-10">
            <div className="text-2xl mb-2">{cat.emoji}</div>
            <p className="font-display font-semibold text-foreground text-sm leading-tight">{cat.label}</p>
            {count > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">{count} listing{count !== 1 ? "s" : ""}</p>
            )}
          </div>
        </motion.button>
      );
    })}
  </div>
);

export default CategoryTiles;
