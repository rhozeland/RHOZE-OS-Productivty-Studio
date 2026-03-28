import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Search,
  MapPin,
  Star,
  Users,
  Clock,
  DollarSign,
  Music,
  Camera,
  Video,
  PenTool,
  Palette,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

const CATEGORIES = [
  { key: "all", label: "All Spaces", icon: Sparkles },
  { key: "recording", label: "Recording", icon: Music, color: "hsl(280, 60%, 55%)" },
  { key: "photo", label: "Photo", icon: Camera, color: "hsl(35, 90%, 50%)" },
  { key: "video", label: "Video", icon: Video, color: "hsl(340, 70%, 55%)" },
  { key: "design", label: "Design", icon: PenTool, color: "hsl(175, 60%, 45%)" },
  { key: "art", label: "Art", icon: Palette, color: "hsl(310, 60%, 65%)" },
];

const ExploreStudiosPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const activeCategory = searchParams.get("category") || "all";

  const { data: studios, isLoading } = useQuery({
    queryKey: ["public-studios", activeCategory],
    queryFn: async () => {
      let query = supabase
        .from("studios")
        .select("*")
        .eq("is_active", true)
        .eq("status", "approved")
        .order("rating_avg", { ascending: false });

      if (activeCategory !== "all") {
        query = query.eq("category", activeCategory);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = studios?.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.location?.toLowerCase().includes(search.toLowerCase()) ||
      s.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={rhozelandLogo} alt="Rhozeland" className="h-8 w-8" />
            <span className="font-body text-lg font-bold tracking-tight text-foreground">Rhozeland</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/explore/studios" className="text-foreground font-medium">Studios</Link>
            <Link to="/explore/creators" className="hover:text-foreground transition-colors">Creators</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="rounded-full">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">Browse Studio Spaces</h1>
          <p className="text-muted-foreground mt-1">Find the perfect creative space for your next project.</p>
        </div>

        {/* Search + filters */}
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or location..." className="pl-10 h-11 rounded-full" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    if (cat.key === "all") params.delete("category");
                    else params.set("category", cat.key);
                    setSearchParams(params);
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${isActive ? "bg-foreground text-background shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
                >
                  <cat.icon className="h-3.5 w-3.5" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-72 bg-muted animate-pulse rounded-2xl" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && filtered?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-display text-lg font-semibold text-foreground mb-1">No studios found</h3>
            <p className="text-muted-foreground text-sm">Check back soon — new studios are added regularly.</p>
          </div>
        )}

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered?.map((studio, i) => (
            <motion.div key={studio.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link to={`/explore/studios/${studio.id}`} className="group block rounded-2xl bg-card border border-border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all">
                <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                  {studio.cover_image_url ? (
                    <img src={studio.cover_image_url} alt={studio.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                      <Building2 className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-background/90 backdrop-blur-sm px-3 py-1.5 text-sm font-bold text-foreground shadow-sm">
                    <DollarSign className="h-3.5 w-3.5" />{studio.hourly_rate}/hr
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display font-semibold text-foreground text-base group-hover:text-primary transition-colors line-clamp-1">{studio.name}</h3>
                    {(studio.review_count ?? 0) > 0 && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Star className="h-3.5 w-3.5 text-warm fill-warm" />
                        <span className="text-sm font-medium">{Number(studio.rating_avg).toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  {studio.short_description && <p className="text-xs text-muted-foreground line-clamp-2">{studio.short_description}</p>}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                    {studio.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {studio.city || studio.location}</span>}
                    <span className="flex items-center gap-1 capitalize"><Clock className="h-3 w-3" /> {studio.category}</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center pt-8 pb-4">
          <p className="text-muted-foreground mb-3">Want to list your studio on Rhozeland?</p>
          <Link to="/auth">
            <Button className="rounded-full gap-2">Get Started <ArrowRight className="h-4 w-4" /></Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ExploreStudiosPage;
