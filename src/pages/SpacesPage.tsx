/**
 * SpacesPage — unified hub for Physical (studios) + Digital (drop rooms).
 * Phase 1 of the Spaces & People restructure. Reuses existing studios and
 * drop_rooms tables; no schema changes.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Radio,
  Search,
  MapPin,
  Star,
  Users,
  DollarSign,
  Plus,
  Clock,
  Flame,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Mode = "physical" | "digital";

const SpacesPage = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const initialMode: Mode = params.get("mode") === "digital" ? "digital" : "physical";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [search, setSearch] = useState("");

  const setModeAndUrl = (m: Mode) => {
    setMode(m);
    const next = new URLSearchParams(params);
    next.set("mode", m);
    setParams(next, { replace: true });
  };

  // ─── Physical studios ─────────────────────────────────────────────────
  const { data: studios, isLoading: loadingStudios } = useQuery({
    queryKey: ["spaces-studios"],
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
    enabled: mode === "physical",
  });

  // ─── Digital drop rooms ───────────────────────────────────────────────
  const { data: rooms, isLoading: loadingRooms } = useQuery({
    queryKey: ["spaces-rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drop_rooms")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: mode === "digital",
  });

  const filteredStudios = useMemo(
    () =>
      (studios ?? []).filter(
        (s: any) =>
          !search ||
          s.name?.toLowerCase().includes(search.toLowerCase()) ||
          s.location?.toLowerCase().includes(search.toLowerCase()) ||
          s.city?.toLowerCase().includes(search.toLowerCase()) ||
          s.category?.toLowerCase().includes(search.toLowerCase()),
      ),
    [studios, search],
  );

  const filteredRooms = useMemo(
    () =>
      (rooms ?? []).filter(
        (r: any) =>
          !search ||
          r.title?.toLowerCase().includes(search.toLowerCase()) ||
          r.description?.toLowerCase().includes(search.toLowerCase()) ||
          r.category?.toLowerCase().includes(search.toLowerCase()),
      ),
    [rooms, search],
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">
            Spaces
          </p>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Where the work happens.
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm max-w-lg">
            Vetted physical studios you can book, and live digital rooms you can
            jump into. Same Rhozeland network — two doors in.
          </p>
        </div>
        {user && mode === "physical" && (
          <Link to="/studios/apply">
            <Button variant="outline" className="rounded-full gap-1.5">
              <Plus className="h-4 w-4" /> List Your Studio
            </Button>
          </Link>
        )}
      </div>

      {/* Mode toggle */}
      <div className="inline-flex p-1 rounded-full bg-card border border-border">
        <button
          onClick={() => setModeAndUrl("physical")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            mode === "physical"
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="h-4 w-4" />
          Physical
        </button>
        <button
          onClick={() => setModeAndUrl("digital")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            mode === "digital"
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Radio className="h-4 w-4" />
          Digital
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={mode === "physical" ? "Search by name, city, vibe…" : "Search live rooms…"}
          className="pl-10 h-11 rounded-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ─── Physical: Studio cards ──────────────────────────────────── */}
      {mode === "physical" && (
        <>
          {loadingStudios && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-72 bg-muted animate-pulse rounded-2xl" />
              ))}
            </div>
          )}

          {!loadingStudios && filteredStudios.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="font-display text-lg font-semibold text-foreground mb-1">
                No studios found
              </h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                {search ? "Try a different search term." : "No studios listed yet — check back soon."}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudios.map((studio: any, i: number) => (
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
                    {studio.show_price !== false && studio.hourly_rate > 0 && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-background/90 backdrop-blur-sm px-3 py-1.5 text-sm font-bold text-foreground shadow-sm">
                        <DollarSign className="h-3.5 w-3.5" />
                        {studio.hourly_rate}/hr
                      </div>
                    )}
                    <div className="absolute top-3 left-3 rounded-full bg-background/90 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-foreground shadow-sm capitalize">
                      {studio.category}
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display font-semibold text-foreground text-base group-hover:text-primary transition-colors line-clamp-1">
                        {studio.name}
                      </h3>
                      {(studio.review_count ?? 0) > 0 && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Star className="h-3.5 w-3.5 text-warm fill-warm" />
                          <span className="text-sm font-medium text-foreground">
                            {Number(studio.rating_avg).toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>
                    {studio.short_description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {studio.short_description}
                      </p>
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
        </>
      )}

      {/* ─── Digital: Drop rooms ─────────────────────────────────────── */}
      {mode === "digital" && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-muted-foreground">
              Digital rooms are live collaboration spaces — A/V, screen-share,
              chat. They self-expire after their host's set duration.
            </p>
            {user && (
              <Link to="/drop-rooms">
                <Button variant="outline" size="sm" className="rounded-full gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Open a room
                </Button>
              </Link>
            )}
          </div>

          {loadingRooms && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-48 bg-muted animate-pulse rounded-2xl" />
              ))}
            </div>
          )}

          {!loadingRooms && filteredRooms.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Radio className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="font-display text-lg font-semibold text-foreground mb-1">
                No live rooms right now
              </h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                Be the first to open one — invite collaborators in real time.
              </p>
              {user && (
                <Link to="/drop-rooms" className="mt-4">
                  <Button className="rounded-full gap-1.5">
                    <Plus className="h-4 w-4" /> Open a room
                  </Button>
                </Link>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRooms.map((room: any, i: number) => {
              const expiresAt = new Date(room.expires_at);
              const expired = expiresAt < new Date();
              return (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link
                    to={`/drop-rooms/${room.id}`}
                    className="group block rounded-2xl bg-card border border-border p-5 hover:shadow-xl hover:-translate-y-1 transition-all relative overflow-hidden"
                    style={
                      room.cover_color
                        ? { background: `linear-gradient(135deg, ${room.cover_color}22, transparent)` }
                        : undefined
                    }
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <Flame className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground capitalize">
                          {room.category}
                        </span>
                      </div>
                      {!expired && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-500">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                          </span>
                          LIVE
                        </span>
                      )}
                    </div>
                    <h3 className="font-display font-semibold text-foreground text-base mb-1.5 line-clamp-1 group-hover:text-primary transition-colors">
                      {room.title}
                    </h3>
                    {room.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                        {room.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {expired
                          ? "Closed"
                          : `Closes ${formatDistanceToNow(expiresAt, { addSuffix: true })}`}
                      </span>
                      {room.max_members && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {room.max_members} max
                        </span>
                      )}
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default SpacesPage;
