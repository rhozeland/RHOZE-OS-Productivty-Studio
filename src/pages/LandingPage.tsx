import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  Building2,
  Search,
  Star,
  Music,
  Camera,
  Video,
  PenTool,
  Palette,
  MapPin,
  DollarSign,
  FolderKanban,
  Users,
  Zap,
  ExternalLink,
} from "lucide-react";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

const STUDIO_CATEGORIES = [
  { icon: Music, label: "Recording", color: "hsl(280, 60%, 55%)" },
  { icon: Camera, label: "Photo", color: "hsl(35, 90%, 50%)" },
  { icon: Video, label: "Video", color: "hsl(340, 70%, 55%)" },
  { icon: PenTool, label: "Design", color: "hsl(175, 60%, 45%)" },
  { icon: Palette, label: "Art", color: "hsl(310, 60%, 65%)" },
];

const LandingPage = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: studios } = useQuery({
    queryKey: ["landing-studios"],
    queryFn: async () => {
      const { data } = await supabase
        .from("studios")
        .select("*")
        .eq("is_active", true)
        .eq("status", "approved")
        .order("rating_avg", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const { data: listings } = useQuery({
    queryKey: ["landing-listings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_listings")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <img src={rhozelandLogo} alt="Rhozeland" className="h-8 w-8" />
            <span className="font-display text-lg font-bold tracking-tight text-foreground">Rhozeland</span>
          </Link>

          {/* Center search */}
          <div className="hidden md:flex flex-1 max-w-lg mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search studios, services, creators..."
                className="pl-10 h-10 rounded-full bg-muted/50 border-border"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link to="/explore/studios" className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors">
              For Studios
            </Link>
            {user ? (
              <Link to="/dashboard">
                <Button size="sm" className="rounded-full text-sm">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm" className="text-sm">Sign in</Button>
                </Link>
                <Link to="/auth">
                  <Button size="sm" className="rounded-full text-sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero cards row */}
      <section className="px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <div className="mx-auto grid grid-cols-1 md:grid-cols-[1fr_380px] gap-4">
          {/* Main hero card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary/20 via-primary/5 to-accent/10 border border-border p-8 md:p-12 min-h-[280px] flex flex-col justify-end"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
            <div className="relative z-10">
              <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight text-foreground mb-2">
                Book studios. Hire creatives.
                <br />
                <span className="gradient-text">Ship projects.</span>
              </h1>
              <p className="text-muted-foreground text-base max-w-md mb-5">
                Project management for creative teams — with built-in collaboration and payments.
              </p>
              <Link to={user ? "/dashboard" : "/auth"}>
                <Button className="rounded-full h-11 px-6 gap-2 text-sm">
                  Make this your place <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Side card — for studios */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-3xl bg-card border border-border p-6 md:p-8 flex flex-col justify-between"
          >
            <div>
              <h2 className="font-display text-xl font-bold text-foreground mb-2">Let creatives find you</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-1">
                List your studio space on Rhozeland.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Fair commissions.<br />
                Transparent bookings.
              </p>
            </div>
            <Link to="/studios/apply" className="mt-6">
              <Button variant="outline" className="rounded-full gap-2 h-10 text-sm w-full">
                Studio dashboard <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Spotlight — Studios */}
      <section className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Spotlight</h2>
              <p className="text-sm text-muted-foreground">Featured studio spaces</p>
            </div>
            <Link to="/explore/studios" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            {(studios && studios.length > 0 ? studios : Array(4).fill(null)).slice(0, 4).map((studio, i) => (
              <motion.div
                key={studio?.id ?? i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
              >
                <Link
                  to={studio ? `/explore/studios/${studio.id}` : "/explore/studios"}
                  className="group flex items-center gap-3 rounded-2xl bg-card border border-border p-3 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <div className="h-16 w-16 shrink-0 rounded-xl bg-muted overflow-hidden">
                    {studio?.cover_image_url ? (
                      <img src={studio.cover_image_url} alt={studio.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                        <Building2 className="h-5 w-5 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                      <Building2 className="h-3 w-3" />
                      <span className="capitalize">{studio?.category ?? "Studio"}</span>
                    </div>
                    <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {studio?.name ?? "Coming Soon"}
                    </p>
                    {studio?.city && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" /> {studio.city}
                      </p>
                    )}
                  </div>
                  {studio && (
                    <div className="shrink-0 text-muted-foreground/60 group-hover:text-primary transition-colors">
                      <ExternalLink className="h-4 w-4" />
                    </div>
                  )}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Spotlight — Creative Services */}
      <section className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Creative Services</h2>
              <p className="text-sm text-muted-foreground">Hire freelance talent</p>
            </div>
            <Link to="/explore/creators" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            {(listings && listings.length > 0 ? listings : Array(4).fill(null)).slice(0, 4).map((listing: any, i: number) => (
              <motion.div
                key={listing?.id ?? i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
              >
                <Link
                  to={listing ? `/explore/creators/${listing.id}` : "/explore/creators"}
                  className="group flex items-center gap-3 rounded-2xl bg-card border border-border p-3 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <div className="h-16 w-16 shrink-0 rounded-xl bg-muted overflow-hidden">
                    {listing?.cover_url || listing?.image_url ? (
                      <img src={listing.cover_url || listing.image_url} alt={listing.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                        <Palette className="h-5 w-5 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                      <Palette className="h-3 w-3" />
                      <span className="capitalize">{listing?.category ?? "Service"}</span>
                    </div>
                    <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {listing?.title ?? "Coming Soon"}
                    </p>
                    {listing?.credits_price && (
                      <p className="text-xs text-muted-foreground mt-0.5">{listing.credits_price} credits</p>
                    )}
                  </div>
                  <div className="shrink-0 text-muted-foreground/60 group-hover:text-primary transition-colors">
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Category tiles */}
      <section className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="mx-auto">
          <h2 className="font-display text-xl font-bold text-foreground mb-4">Browse by Category</h2>
          <div className="flex items-center gap-3 flex-wrap">
            {STUDIO_CATEGORIES.map((cat, i) => (
              <motion.div key={cat.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 * i }}>
                <Link
                  to={`/explore/studios?category=${cat.label.toLowerCase()}`}
                  className="flex items-center gap-2.5 rounded-2xl bg-card border border-border px-5 py-3 hover:shadow-md hover:-translate-y-0.5 transition-all group"
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-sm transition-transform group-hover:scale-110"
                    style={{ backgroundColor: cat.color }}
                  >
                    <cat.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{cat.label}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Rhozeland — compact */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-border">
        <div className="mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          {[
            { icon: Building2, title: "Book Studios", desc: "Find and book creative spaces by the hour." },
            { icon: Users, title: "Hire Talent", desc: "Browse freelance creatives on the marketplace." },
            { icon: FolderKanban, title: "Ship Projects", desc: "Manage projects with built-in collaboration." },
          ].map((f) => (
            <div key={f.title} className="flex flex-col items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground max-w-xs">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom nav — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl">
        <div className="flex items-center justify-around h-14">
          <Link to="/" className="flex flex-col items-center gap-0.5 text-primary">
            <Building2 className="h-5 w-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link to="/explore/studios" className="flex flex-col items-center gap-0.5 text-muted-foreground">
            <Search className="h-5 w-5" />
            <span className="text-[10px] font-medium">Explore</span>
          </Link>
          <Link to="/explore/creators" className="flex flex-col items-center gap-0.5 text-muted-foreground">
            <Palette className="h-5 w-5" />
            <span className="text-[10px] font-medium">Services</span>
          </Link>
          <Link to="/auth" className="flex flex-col items-center gap-0.5 text-muted-foreground">
            <Users className="h-5 w-5" />
            <span className="text-[10px] font-medium">Sign in</span>
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-8 pb-20 md:pb-8">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={rhozelandLogo} alt="Rhozeland" className="h-6 w-6" />
            <span className="font-display text-sm font-semibold text-foreground">Rhozeland</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/explore/studios" className="hover:text-foreground">Studios</Link>
            <Link to="/explore/creators" className="hover:text-foreground">Creators</Link>
            <Link to="/auth" className="hover:text-foreground">Sign In</Link>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 Rhozeland. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
