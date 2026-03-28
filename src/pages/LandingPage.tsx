import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

const LandingPage = () => {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Please enter a valid email.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("waitlist" as any)
        .insert({ email: trimmed } as any);
      if (error && error.code === "23505") {
        toast.info("You're already on the list!");
      } else if (error) {
        throw error;
      } else {
        toast.success("You're on the list! We'll be in touch.");
        setEmail("");
      }
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 items-center justify-between px-4 sm:px-6 max-w-5xl">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={rhozelandLogo} alt="Rhozeland" className="h-7 w-7" />
            <span className="font-display text-base font-bold tracking-tight text-foreground">
              Rhozeland
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/dashboard">
                <Button size="sm" variant="ghost" className="text-sm">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Link to="/auth">
                <Button size="sm" variant="ghost" className="text-sm">
                  Sign in
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero — vertically centered */}
      <section className="flex-1 flex items-center justify-center px-4 sm:px-6 relative overflow-hidden">
        {/* Soft radial glow */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, hsl(var(--primary) / 0.06) 0%, transparent 70%)",
            }}
          />
        </div>

        <div className="relative z-10 max-w-lg mx-auto text-center py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/15 px-3 py-1 mb-8">
              <Flame className="h-3 w-3 text-primary" />
              <span className="text-[11px] font-medium text-primary tracking-wide">
                EARLY ACCESS
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold leading-[1.15] text-foreground mb-4">
              Where creatives
              <br />
              <span className="gradient-text">build together.</span>
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground max-w-sm mx-auto mb-10 leading-relaxed">
              Book studios. Hire talent. Ship projects.
              <br />
              One workspace for your creative team.
            </p>

            {/* Waitlist form */}
            <form
              onSubmit={handleWaitlist}
              className="flex flex-col sm:flex-row items-center gap-2.5 max-w-sm mx-auto"
            >
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-full text-sm bg-muted/50 border-border px-4 flex-1 w-full"
                maxLength={255}
                disabled={submitting}
              />
              <Button
                type="submit"
                disabled={submitting}
                className="rounded-full h-11 px-6 gap-2 text-sm font-medium shrink-0 w-full sm:w-auto"
              >
                {submitting ? "Joining…" : "Join Waitlist"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </form>

            <p className="text-[11px] text-muted-foreground/60 mt-4">
              Early members earn founding badges & bonus Rose Coins.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <img src={rhozelandLogo} alt="" className="h-4 w-4 opacity-50" />
            <span className="text-xs text-muted-foreground">
              © 2026 Rhozeland
            </span>
          </div>
          <Link
            to="/auth"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in →
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
