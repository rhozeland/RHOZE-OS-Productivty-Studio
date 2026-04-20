import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

const AuthPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Where to send the user after a successful sign in (e.g. ?redirect=/studios/abc)
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;

        if (data.session) {
          toast.success("Account created — let's set things up!");
          navigate("/onboarding", { replace: true });
          return;
        }

        toast.success("Account created. Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in.");
        navigate(redirectTo, { replace: true });
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error, redirected } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: {
          prompt: "select_account",
        },
      });

      if (redirected) return;

      if (error) {
        toast.error(error.message || "Google sign-in failed");
        return;
      }

      toast.success("Signed in with Google.");
      navigate(redirectTo, { replace: true });
    } catch (error: any) {
      toast.error(error.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden">
      {/* Animated mesh gradient background */}
      <div
        className="pointer-events-none fixed inset-0 animated-gradient"
        style={{
          background: `
            linear-gradient(
              135deg,
              hsl(280 65% 72% / 0.35) 0%,
              hsl(320 65% 62% / 0.30) 25%,
              hsl(30 75% 62% / 0.28) 50%,
              hsl(175 55% 52% / 0.25) 75%,
              hsl(280 65% 72% / 0.35) 100%
            )
          `,
          backgroundSize: '300% 300%',
        }}
      />
      {/* Secondary aurora layer for depth */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 60% at 20% 50%, hsl(280 60% 75% / 0.15) 0%, transparent 60%),
            radial-gradient(ellipse 60% 70% at 80% 30%, hsl(320 60% 65% / 0.12) 0%, transparent 60%),
            radial-gradient(ellipse 65% 45% at 50% 85%, hsl(30 70% 65% / 0.10) 0%, transparent 60%)
          `,
          animation: 'aurora-drift 20s ease-in-out infinite',
        }}
      />

      {/* Grain texture */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.5\'/%3E%3C/svg%3E")' }} />

      {/* Top nav */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-5"
      >
        <div className="flex items-center gap-2.5">
          <img src={rhozelandLogo} alt="Rhozeland" className="h-8 w-8" />
          <span className="font-body text-lg font-bold tracking-tight text-foreground">Rhozeland</span>
        </div>
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {isSignUp ? "Already have an account?" : "Need an account?"}
        </button>
      </motion.div>

      {/* Centered card */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Glass card */}
        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl p-8 sm:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.8 }}
              className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/5 border border-border/50 mb-5"
            >
              <motion.div
                animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.15, 0.95, 1] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
              >
                <Sparkles className="h-5 w-5 text-muted-foreground" />
              </motion.div>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.0 }}
              className="font-display text-2xl font-bold text-foreground"
            >
              {isSignUp ? "Create your account" : "Welcome back"}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.15 }}
              className="mt-1.5 text-sm text-muted-foreground"
            >
              {isSignUp ? "Join the creative workspace" : "Sign in to continue"}
            </motion.p>
          </div>

          {/* Google sign-in */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 font-medium rounded-xl border-border/80 hover:bg-secondary/50 transition-all"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card/80 px-3 text-muted-foreground">or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1.5"
              >
                <Label htmlFor="name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" required className="h-12 rounded-xl bg-secondary/30 border-border/50 focus:bg-background transition-colors" />
              </motion.div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@studio.com" required className="h-12 rounded-xl bg-secondary/30 border-border/50 focus:bg-background transition-colors" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-12 rounded-xl bg-secondary/30 border-border/50 focus:bg-background transition-colors" />
            </div>
            <Button type="submit" className="w-full h-12 font-semibold rounded-xl text-sm" disabled={loading}>
              {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        {/* Footer tagline */}
        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          © 2026 Rhozeland. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
};

export default AuthPage;
