import { useAuth } from "@/contexts/AuthContext";
import {
  Sparkles, Coins, Zap, LayoutGrid, Flame, ArrowRight,
  Star, MessageSquare, Award, TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Leaderboard from "@/components/creators/Leaderboard";
import CreatorJourney from "@/components/creators/CreatorJourney";

const NAV_BUBBLES = [
  { key: "listings", label: "Listings", icon: Sparkles, path: "/marketplace", color: "hsl(280 60% 60%)" },
  { key: "flow", label: "Flow", icon: Flame, path: "/flow", color: "hsl(30 90% 60%)" },
  { key: "droprooms", label: "Drop Rooms", icon: Zap, path: "/drop-rooms", color: "hsl(175 70% 50%)" },
  { key: "boards", label: "Boards", icon: LayoutGrid, path: "/smartboards", color: "hsl(210 60% 55%)" },
  { key: "claim", label: "Claim", icon: Coins, path: "/credits", color: "hsl(40 80% 50%)" },
];

const REWARD_ACTIONS = [
  { action: "Post to Flow", reward: "+2 $RHOZE", icon: Flame, description: "Share creative work in your Flow feed" },
  { action: "Receive a Like/Save", reward: "+1 $RHOZE", icon: Star, description: "Earned when someone engages with your post" },
  { action: "Leave a Review", reward: "+3 $RHOZE", icon: MessageSquare, description: "Review a listing you purchased" },
  { action: "Milestone Approved", reward: "+10 $RHOZE", icon: Award, description: "Complete a project milestone for a client" },
  { action: "Post in Drop Room", reward: "+1 $RHOZE", icon: Zap, description: "Contribute ideas in collaborative rooms" },
  { action: "7-Day Streak", reward: "+5 $RHOZE", icon: TrendingUp, description: "Log in 7 days in a row" },
];

const CreatorsHubPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-lg">
        <div className="absolute inset-0 grid-overlay pointer-events-none" />
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="iridescent-blob absolute -top-10 right-0 w-[400px] h-[250px] rounded-full opacity-50"
            style={{
              background: "linear-gradient(135deg, hsl(280, 80%, 70%), hsl(320, 80%, 60%), hsl(30, 90%, 60%))",
              filter: "blur(50px)",
            }}
          />
        </div>
        <div className="relative z-10 px-8 py-10 md:px-10 md:py-14">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="text-xs font-body font-medium text-muted-foreground uppercase tracking-[0.2em] mb-3">
                Community
              </p>
              <h1 className="font-display text-3xl md:text-5xl text-foreground leading-[1.1] mb-3">
                Creators Hub
              </h1>
              <p className="text-sm text-muted-foreground max-w-md font-body leading-relaxed">
                Discover services, find talent, and post creative projects.
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-3 px-5 py-3 rounded-lg border border-dashed border-foreground/20 bg-card/60 backdrop-blur-sm"
            >
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Coins className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground font-body">Earn $RHOZE</p>
                <p className="text-[11px] text-muted-foreground font-body">Post, collab, curate → earn tokens</p>
              </div>
              <button
                onClick={() => navigate("/credits")}
                className="text-xs font-body text-foreground underline underline-offset-2 shrink-0 ml-2"
              >
                Learn&nbsp;more
              </button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Bubble Nav Dashboard */}
      <div className="grid grid-cols-5 gap-3">
        {NAV_BUBBLES.map((item, i) => (
          <motion.button
            key={item.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            onClick={() => navigate(item.path)}
            className="group flex flex-col items-center gap-2.5 p-5 rounded-2xl border border-border bg-card hover:border-foreground/30 transition-all"
          >
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
              style={{ background: `${item.color}18`, border: `1.5px solid ${item.color}50` }}
            >
              <item.icon className="h-5 w-5" style={{ color: item.color }} />
            </div>
            <span className="text-xs font-bold text-foreground font-body">{item.label}</span>
          </motion.button>
        ))}
      </div>

      {/* How to Earn $RHOZE */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-xl border border-border bg-card p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Coins className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-foreground">How to Earn $RHOZE</h2>
          <span className="ml-auto text-[10px] text-muted-foreground font-body bg-muted px-2 py-0.5 rounded-full">
            Admin-verified before credited
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {REWARD_ACTIONS.map((action, i) => (
            <motion.div
              key={action.action}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.02 * i }}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/40 hover:bg-card/80 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <action.icon className="h-4 w-4 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-body font-medium text-foreground">{action.action}</p>
                <p className="text-[10px] text-muted-foreground font-body">{action.description}</p>
              </div>
              <span className="text-xs font-body font-semibold text-primary shrink-0">{action.reward}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Creator Journey */}
      <CreatorJourney />

      {/* Leaderboard */}
      <Leaderboard />
    </div>
  );
};

export default CreatorsHubPage;
