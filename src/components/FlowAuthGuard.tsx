import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

/**
 * Guards the /flow route. Logged-out visitors see an in-app gate screen
 * explaining Flow Mode is members-only, with a clear CTA to sign in.
 */
export const FlowAuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <div className="relative min-h-[80vh] flex items-center justify-center px-6 overflow-hidden">
        {/* Soft pink → amber → mint orb */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70 blur-3xl"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, hsl(330 85% 70% / 0.45), transparent 55%)," +
              "radial-gradient(circle at 70% 60%, hsl(38 92% 65% / 0.45), transparent 60%)," +
              "radial-gradient(circle at 50% 90%, hsl(160 65% 60% / 0.30), transparent 60%)",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative max-w-md w-full text-center rounded-3xl border border-border/60 bg-card/70 backdrop-blur-xl p-8 sm:p-10 shadow-2xl"
        >
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-foreground/5 border border-border/60 mb-5">
            <Sparkles className="h-5 w-5 text-foreground/80" />
          </div>

          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">
            Flow Mode
          </p>
          <h1 className="font-display text-3xl sm:text-4xl leading-tight tracking-tight text-foreground">
            Members only.
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
            Flow is where you swipe through new work from verified artists,
            comment, save, and earn $RHOZE. Sign in to step inside.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/auth?redirect=/flow">
                Sign in to enter Flow
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="rounded-full">
              <Link to="/discover">Keep exploring</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
};

export default FlowAuthGuard;
