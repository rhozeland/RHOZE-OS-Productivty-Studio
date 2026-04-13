import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  Handshake,
  Crown,
  Lock,
  ArrowRight,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "discover", label: "Discover", icon: Search },
  { key: "circles", label: "Circles", icon: Users },
] as const;

type TabKey = typeof TABS[number]["key"];

const CIRCLES = [
  { name: "Producers", desc: "Music producers, beat makers, and sound designers", tier: "Spark", color: "hsl(280 60% 60%)", members: 0 },
  { name: "Visual Artists", desc: "Photographers, videographers, and graphic designers", tier: "Bloom", color: "hsl(175 70% 50%)", members: 0 },
  { name: "Studio Owners", desc: "Exclusive circle for verified studio operators", tier: "Glow", color: "hsl(40 80% 50%)", members: 0 },
  { name: "Industry Connect", desc: "A&Rs, managers, and label reps networking space", tier: "Play", color: "hsl(350 60% 55%)", members: 0 },
];

const NetworkPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("discover");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: creators } = useQuery({
    queryKey: ["network-creators", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, headline, skills, mediums, is_public")
        .eq("is_public", true)
        .neq("user_id", user?.id ?? "")
        .order("updated_at", { ascending: false })
        .limit(20);

      if (searchQuery.trim()) {
        query = query.ilike("display_name", `%${searchQuery.trim()}%`);
      }
      const { data } = await query;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: myConnections } = useQuery({
    queryKey: ["my-connections", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("connections")
        .select("following_id, status")
        .eq("follower_id", user!.id);
      return new Map(data?.map((c) => [c.following_id, c.status]) ?? []);
    },
    enabled: !!user,
  });

  const handleConnect = async (targetId: string) => {
    if (!user) return;
    await supabase.from("connections").insert({
      follower_id: user.id,
      following_id: targetId,
      type: "follow",
      status: "active",
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-lg">
        <div className="absolute inset-0 grid-overlay pointer-events-none" />
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="iridescent-blob absolute -top-10 right-0 w-[400px] h-[250px] rounded-full opacity-50"
            style={{
              background: "linear-gradient(135deg, hsl(210, 60%, 55%), hsl(280, 60%, 60%), hsl(175, 70%, 50%))",
              filter: "blur(50px)",
            }}
          />
        </div>
        <div className="relative z-10 px-8 py-10 md:px-10 md:py-14">
          <p className="text-xs font-body font-medium text-muted-foreground uppercase tracking-[0.2em] mb-3">Networking</p>
          <h1 className="font-display text-3xl md:text-5xl text-foreground leading-[1.1] mb-3">Network</h1>
          <p className="text-sm text-muted-foreground max-w-md font-body leading-relaxed">
            Discover creators, join exclusive circles, and build meaningful connections.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-body font-medium transition-colors relative whitespace-nowrap shrink-0",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {active && <motion.div layoutId="network-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* Discover */}
        {activeTab === "discover" && (
          <motion.div key="discover" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search creators..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-lg"
              />
            </div>

            {!creators || creators.length === 0 ? (
              <div className="card-dashed p-16 text-center">
                <Users className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground font-body">No creators found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {creators.map((creator, i) => {
                  const initials = creator.display_name
                    ? creator.display_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                    : "?";
                  const isConnected = myConnections?.has(creator.user_id);

                  return (
                    <motion.div
                      key={creator.user_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border border-border rounded-lg bg-card p-4 hover:border-border/80 transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10 border border-border shrink-0 cursor-pointer" onClick={() => navigate(`/profiles/${creator.user_id}`)}>
                          <AvatarImage src={creator.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px] font-semibold bg-muted text-muted-foreground">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <button onClick={() => navigate(`/profiles/${creator.user_id}`)} className="text-sm font-medium text-foreground truncate hover:text-accent transition-colors font-body block text-left">
                            {creator.display_name || "Creator"}
                          </button>
                          {creator.headline && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5 font-body">{creator.headline}</p>
                          )}
                          {creator.skills && creator.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {creator.skills.slice(0, 3).map((s: string) => (
                                <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-body">{s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                        {isConnected ? (
                          <Button size="sm" variant="outline" className="flex-1 text-xs h-8 rounded-lg" onClick={() => navigate(`/messages?to=${creator.user_id}`)}>
                            <MessageSquare className="h-3 w-3 mr-1" /> Message
                          </Button>
                        ) : (
                          <Button size="sm" className="flex-1 text-xs h-8 rounded-lg" onClick={() => handleConnect(creator.user_id)}>
                            <Handshake className="h-3 w-3 mr-1" /> Connect
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-xs h-8 px-2" onClick={() => navigate(`/profiles/${creator.user_id}`)}>
                          View
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Circles */}
        {activeTab === "circles" && (
          <motion.div key="circles" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
            <p className="text-sm text-muted-foreground font-body">
              Exclusive networking groups gated by Creator Pass tier.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CIRCLES.map((circle, i) => {
                const isLocked = circle.tier !== "Spark";
                return (
                  <motion.div
                    key={circle.name}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className={cn(
                      "border rounded-xl p-5 transition-all",
                      isLocked ? "border-border/40 bg-card/50 opacity-70" : "border-border bg-card hover:border-border/80"
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center border border-border/30"
                        style={{ background: `${circle.color}15` }}
                      >
                        <Users className="h-5 w-5" style={{ color: circle.color }} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isLocked ? (
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: circle.color }}>
                          {circle.tier}
                        </span>
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-foreground mb-1">{circle.name}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-4">{circle.desc}</p>
                    {isLocked ? (
                      <Button size="sm" variant="outline" className="w-full text-xs h-8 rounded-lg" onClick={() => navigate("/credits")}>
                        <Crown className="h-3 w-3 mr-1" /> Upgrade to {circle.tier}
                      </Button>
                    ) : (
                      <Button size="sm" className="w-full text-xs h-8 rounded-lg">
                        Join Circle <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NetworkPage;
