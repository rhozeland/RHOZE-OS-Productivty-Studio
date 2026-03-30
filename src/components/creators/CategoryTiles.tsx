import { Music, Palette, Camera, Video, PenTool } from "lucide-react";

import { Music, Palette, Camera, Video, PenTool, Users } from "lucide-react";

const CATEGORIES = [
  { key: "music", label: "Audio", icon: Music, accent: "hsl(280 60% 55%)" },
  { key: "design", label: "Design", icon: Palette, accent: "hsl(160 60% 50%)" },
  { key: "photo", label: "Photo", icon: Camera, accent: "hsl(35 90% 55%)" },
  { key: "video", label: "Video", icon: Video, accent: "hsl(340 70% 55%)" },
  { key: "writing", label: "Writing", icon: PenTool, accent: "hsl(210 60% 55%)" },
  { key: "talent", label: "Talent", icon: Users, accent: "hsl(25 80% 55%)" },
];

interface CategoryTilesProps {
  activeCategory: string;
  onSelect: (key: string) => void;
  listingCounts?: Record<string, number>;
}

const CategoryTiles = ({ activeCategory, onSelect, listingCounts }: CategoryTilesProps) => (
  <div className="flex items-center gap-2 flex-wrap">
    <button
      onClick={() => onSelect("all")}
      className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-all ${
        activeCategory === "all"
          ? "bg-foreground text-background shadow-sm"
          : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
      }`}
    >
      All
    </button>
    {CATEGORIES.map((cat) => {
      const Icon = cat.icon;
      const isActive = activeCategory === cat.key;
      const count = listingCounts?.[cat.key] ?? 0;
      return (
        <button
          key={cat.key}
          onClick={() => onSelect(isActive ? "all" : cat.key)}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-all ${
            isActive
              ? "text-white shadow-sm"
              : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
          }`}
          style={isActive ? { background: cat.accent } : undefined}
        >
          <Icon className="h-3.5 w-3.5" style={!isActive ? { color: cat.accent } : undefined} />
          {cat.label}
          {count > 0 && (
            <span className={`text-[10px] ${isActive ? "text-white/70" : "text-muted-foreground"}`}>
              {count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export default CategoryTiles;
