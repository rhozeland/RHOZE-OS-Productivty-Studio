import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Star,
  ArrowRight,
  Palette,
  Music,
  Camera,
  Video,
  PenTool,
  Sparkles,
} from "lucide-react";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

const CATEGORIES = [
  { key: "all", label: "All", icon: Sparkles },
  { key: "audio", label: "Audio", icon: Music },
  { key: "design", label: "Design", icon: PenTool },
  { key: "photo", label: "Photo", icon: Camera },
  { key: "video", label: "Video", icon: Video },
  { key: "writing", label: "Writing", icon: Palette },
];

const ExploreCreatorsPage = () => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const { data: listings, isLoading } = useQuery({
    queryKey: ["public-listings", activeCategory],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_listings")
        .select("*, profiles!marketplace_listings_user_id_fkey(display_name, avatar_url)")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (activeCategory !== "all") {
        query = query.eq("category", activeCategory);
      }

      const { data, error } = await query;
      if (error) {
        // Fallback without join if fkey doesn't exist
        const { data: fallback } = await supabase
          .from("marketplace_listings")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false });
        return fallback ?? [];
      }
      return data ?? [];
    },
  });

  const filtered = listings?.filter(
    (l: any) =>
      !search ||
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={rhozelandLogo} alt="Rhozeland" className="h-8 w-8" />
            <span className="font-display text-lg font-bold tracking-tight text-foreground">Rhozeland</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/explore/studios" className="hover:text-foreground transition-colors">Studios</Link>
            <Link to="/explore/creators" className="text-foreground font-medium">Creators</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm">Log in</Button></Link>
            <Link to="/auth"><Button size="sm" className="rounded-full">Get Started</Button></Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">Browse Creative Services</h1>
          <p className="text-muted-foreground mt-1">Discover freelance talent for your next project.</p>
        </div>

        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search services..." className="pl-10 h-11 rounded-full" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${activeCategory === cat.key ? "bg-foreground text-background shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
              >
                <cat.icon className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-64 bg-muted animate-pulse rounded-2xl" />)}
          </div>
        )}

        {!isLoading && filtered?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Palette className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-display text-lg font-semibold text-foreground mb-1">No services found</h3>
            <p className="text-muted-foreground text-sm">Check back soon — new creatives join regularly.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered?.map((listing: any, i: number) => (
            <motion.div key={listing.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link to={`/explore/creators/${listing.id}`} className="group block rounded-2xl bg-card border border-border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all">
                <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                  {listing.cover_url || listing.image_url ? (
                    <img src={listing.cover_url || listing.image_url} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                      <Palette className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                  {listing.credits_price && (
                     <div className="absolute top-3 right-3 rounded-full bg-background/90 backdrop-blur-sm px-3 py-1.5 text-sm font-bold text-foreground shadow-sm">
                       {listing.credits_price} ◊
                     </div>
                  )}
                </div>
                <div className="p-4 space-y-1.5">
                  <h3 className="font-display font-semibold text-foreground text-base group-hover:text-primary transition-colors line-clamp-1">{listing.title}</h3>
                  {listing.description && <p className="text-xs text-muted-foreground line-clamp-2">{listing.description}</p>}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground capitalize pt-1">
                    <span className="bg-muted rounded-full px-2 py-0.5">{listing.category}</span>
                    <span className="bg-muted rounded-full px-2 py-0.5">{listing.listing_type?.replace("_", " ")}</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="text-center pt-8 pb-4">
          <p className="text-muted-foreground mb-3">Want to offer your creative services?</p>
          <Link to="/auth"><Button className="rounded-full gap-2">Join Rhozeland <ArrowRight className="h-4 w-4" /></Button></Link>
        </div>
      </div>
    </div>
  );
};

export default ExploreCreatorsPage;
