import { motion } from "framer-motion";
import {
  Building2, Palette, Users, Coins, Radio, FolderKanban,
  ArrowRight, Sparkles, MessageSquare, Flame,
} from "lucide-react";
import { Link } from "react-router-dom";

const FEATURES = [
  {
    icon: Building2,
    title: "Studios",
    description: "Book creative spaces — recording, photo, design studios — by the hour.",
    path: "/explore/studios",
    color: "hsl(280, 60%, 60%)",
  },
  {
    icon: Flame,
    title: "Creators Hub",
    description: "Browse services, discover talent, and post your own creative offerings.",
    path: "/explore/creators",
    color: "hsl(30, 90%, 60%)",
  },
  {
    icon: Palette,
    title: "Smartboards",
    description: "Collaborative mood boards for visual brainstorming with your team.",
    path: "/smartboards",
    color: "hsl(210, 60%, 55%)",
  },
  {
    icon: Radio,
    title: "Drop Rooms",
    description: "Live collaborative spaces with video, audio, and real-time sharing.",
    path: "/drop-rooms",
    color: "hsl(175, 70%, 50%)",
  },
  {
    icon: FolderKanban,
    title: "Projects",
    description: "Track milestones, manage budgets, and collaborate with escrow protection.",
    path: "/projects",
    color: "hsl(340, 60%, 58%)",
  },
  {
    icon: Coins,
    title: "Creator Pass",
    description: "Earn $RHOZE tokens, unlock tiers, and access premium features.",
    path: "/credits",
    color: "hsl(45, 85%, 52%)",
  },
];

const GuestDashboardPreview = () => (
  <div className="space-y-8">
    {/* Feature grid */}
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-foreground">Explore the Platform</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06 }}
          >
            <Link
              to={f.path}
              className="block border border-border rounded-lg p-5 bg-card hover:bg-muted/50 transition-colors group h-full"
            >
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center mb-3"
                style={{ backgroundColor: `${f.color}20` }}
              >
                <f.icon className="h-5 w-5" style={{ color: f.color }} />
              </div>
              <p className="text-sm font-semibold text-foreground font-body mb-1 group-hover:text-accent transition-colors">
                {f.title}
              </p>
              <p className="text-xs text-muted-foreground font-body leading-relaxed">
                {f.description}
              </p>
              <span className="inline-flex items-center gap-1 text-[11px] text-primary font-body font-medium mt-3">
                Explore <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>

    {/* How it works */}
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="border border-border rounded-lg p-6 bg-card"
    >
      <h3 className="font-display text-lg text-foreground mb-4 text-center">How Rhozeland Works</h3>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
        {[
          { step: "1", label: "Create", desc: "Post services, share work, build your portfolio" },
          { step: "2", label: "Earn", desc: "Every action earns $RHOZE tokens" },
          { step: "3", label: "Grow", desc: "Build a verified Earning History as proof of your work" },
          { step: "4", label: "Reinvest", desc: "Use tokens for bookings, upgrades & marketplace" },
        ].map((s, i) => (
          <div key={s.step} className="space-y-2">
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto text-sm font-bold font-display">
              {s.step}
            </div>
            <p className="text-sm font-semibold text-foreground font-body">{s.label}</p>
            <p className="text-[11px] text-muted-foreground font-body leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </motion.div>

    {/* CTA */}
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6 }}
      className="text-center"
    >
      <Link to="/auth" className="btn-editorial inline-flex items-center gap-2">
        Join Rhozeland <ArrowRight className="h-4 w-4" />
      </Link>
      <p className="text-[11px] text-muted-foreground font-body mt-2">Free to start · No credit card required</p>
    </motion.div>
  </div>
);

export default GuestDashboardPreview;
