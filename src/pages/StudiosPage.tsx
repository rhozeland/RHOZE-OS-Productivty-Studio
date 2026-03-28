import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Search,
  MapPin,
  Star,
  Users,
  Clock,
  Plus,
  DollarSign,
} from "lucide-react";

const StudiosPage = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: studios, isLoading } = useQuery({
    queryKey: ["studios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studios")
        .select("*")
        .eq("is_active", true)
        .eq("status", "approved")
        .order("rating_avg", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = studios?.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.location?.toLowerCase().includes(search.toLowerCase()) ||
      s.city?.toLowerCase().includes(search.toLowerCase()) ||
      s.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">
            Studio Spaces
          </h1>
          <p className="text-muted-foreground mt-1">
            Find and book creative studios by the hour — recording, photo, video, and more.
          </p>
        </div>
        {user && (
          <Link to="/studios/apply">
            <Button variant="outline" className="rounded-full gap-1.5">
              <Plus className="h-4 w-4" /> List Your Studio
            </Button>
          </Link>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, location, or category..."
          className="pl-10 h-11 rounded-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-72 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-display text-lg font-semibold text-foreground mb-1">No studios found</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            {search
              ? "Try a different search term."
              : "No studios are listed yet. Check back soon!"}
          </p>
          {user && (
            <Link to="/studios/apply" className="mt-4">
              <Button variant="outline" className="rounded-full gap-1.5">
                <Plus className="h-4 w-4" /> List Your Studio
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Studio cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered?.map((studio, i) => (
          <motion.div
            key={studio.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link
              to={`/studios/${studio.id}`}
              className="group block rounded-2xl bg-card border border-border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all"
            >
              {/* Cover image */}
              <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                {studio.cover_image_url ? (
                  <img
                    src={studio.cover_image_url}
                    alt={studio.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                    <Building2 className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                )}
                {/* Price badge */}
                <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-background/90 backdrop-blur-sm px-3 py-1.5 text-sm font-bold text-foreground shadow-sm">
                  <DollarSign className="h-3.5 w-3.5" />
                  {studio.hourly_rate}/hr
                </div>
                {/* Category badge */}
                <div className="absolute top-3 left-3 rounded-full bg-background/90 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-foreground shadow-sm capitalize">
                  {studio.category}
                </div>
              </div>

              {/* Info */}
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display font-semibold text-foreground text-base group-hover:text-primary transition-colors line-clamp-1">
                    {studio.name}
                  </h3>
                  {(studio.review_count ?? 0) > 0 && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Star className="h-3.5 w-3.5 text-warm fill-warm" />
                      <span className="text-sm font-medium text-foreground">{Number(studio.rating_avg).toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">({studio.review_count})</span>
                    </div>
                  )}
                </div>

                {studio.short_description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{studio.short_description}</p>
                )}

                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                  {studio.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {studio.city || studio.location}
                    </span>
                  )}
                  {studio.max_guests && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> Up to {studio.max_guests}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default StudiosPage;
