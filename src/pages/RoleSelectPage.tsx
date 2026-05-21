import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

type Role = "fan" | "creator";

const FAN_BULLETS = [
  "Discover rising creators",
  "Back artists and own your rank",
  "Earn $RHOZE rewards",
];

const CREATOR_BULLETS = [
  "Get hired and collaborate",
  "Build a fanbase that backs you",
  "Earn money and $RHOZE",
];

const RoleSelectPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saving, setSaving] = useState<Role | null>(null);

  const choose = async (role: Role) => {
    if (!user || saving) return;
    setSaving(role);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ user_type: role } as any)
        .eq("user_id", user.id);
      if (error) throw error;
      // Role-specific home — fans land on Discover, creators on their Studio.
      navigate(role === "creator" ? "/dashboard" : "/discover", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Couldn't save your choice. Try again.");
      setSaving(null);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden px-4 py-10">
      {/* Same ambient gradient as Auth / Onboarding so it feels native. */}
      <div
        className="pointer-events-none fixed inset-0 animated-gradient"
        style={{
          background: `linear-gradient(135deg, hsl(280 65% 72% / 0.2) 0%, hsl(320 65% 62% / 0.15) 25%, hsl(30 75% 62% / 0.14) 50%, hsl(175 55% 52% / 0.12) 75%, hsl(280 65% 72% / 0.2) 100%)`,
          backgroundSize: "300% 300%",
        }}
      />

      <div className="relative z-10 w-full max-w-3xl">
        {/* Logo + headline */}
        <div className="text-center mb-10">
          <img
            src={rhozelandLogo}
            alt="Rhozeland"
            className="w-12 h-12 object-contain mx-auto mb-6"
          />
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-3">
            How do you want to use Rhozeland?
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            You can switch anytime — this just personalizes your experience
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Fan card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl p-8 flex flex-col"
          >
            <h2 className="font-display text-xl font-bold text-foreground mb-2">
              I'm a Fan
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Discover independent creators, back them before they blow up, and earn rewards for showing up early
            </p>
            <ul className="space-y-2.5 mb-8 flex-1">
              {FAN_BULLETS.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-foreground/90">
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-foreground/70" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <Button
              onClick={() => choose("fan")}
              disabled={saving !== null}
              className="rounded-xl h-11 w-full font-semibold"
            >
              {saving === "fan" ? "Setting up…" : "Continue as Fan"}
            </Button>
          </motion.div>

          {/* Creator card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl p-8 flex flex-col"
          >
            <h2 className="font-display text-xl font-bold text-foreground mb-2">
              I'm a Creator
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Get discovered, get hired, build your fanbase and earn real money and $RHOZE doing what you do
            </p>
            <ul className="space-y-2.5 mb-8 flex-1">
              {CREATOR_BULLETS.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-foreground/90">
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-foreground/70" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              onClick={() => choose("creator")}
              disabled={saving !== null}
              className="rounded-xl h-11 w-full font-semibold"
            >
              {saving === "creator" ? "Setting up…" : "Continue as Creator"}
            </Button>
          </motion.div>
        </div>

        {/* Sign-in hint */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Already have an account?{" "}
          <Link to="/auth" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RoleSelectPage;
