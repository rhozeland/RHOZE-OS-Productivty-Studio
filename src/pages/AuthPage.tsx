import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowUpRight, Sparkles, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

const REFERRAL_STORAGE_KEY = "pending_referral_code";

const AuthPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  // Email path is hidden by default — Google is dominant. User opens it via "Use email instead".
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  // Referral input is HIDDEN by default. We only show it when:
  //   • the URL carries ?ref=CODE (campaign link), or
  //   • the user explicitly clicks "Have a referral code?".
  // This stops random new accounts from farming the SHOPIFY/event codes —
  // you have to know a code exists to redeem one.
  const [showReferral, setShowReferral] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Where to send the user after a successful sign in (e.g. ?redirect=/studios/abc)
  const redirectTo = searchParams.get("redirect") || "/discover";

  // Persist any entered referral code so it survives the OAuth redirect
  // and is redeemed by AppLayout once the user is authenticated.
  const stashReferralCode = () => {
    const code = referralCode.trim().toUpperCase();
    if (code) {
      try {
        localStorage.setItem(REFERRAL_STORAGE_KEY, code);
      } catch {}
    }
  };

  // Auto-open the referral field if a campaign link delivered the user here
  // with ?ref=CODE (e.g. shopify.com → rhozeland.app/auth?ref=SHOPIFY). The
  // field stays hidden for organic signups so codes aren't broadcast.
  const refFromUrl = searchParams.get("ref");
  if (refFromUrl && !referralCode) {
    // setState during render is safe because it's guarded; React bails out
    // once values stabilise.
    setReferralCode(refFromUrl.toUpperCase());
    setShowReferral(true);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        stashReferralCode();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            // Email-confirmed signups land on onboarding so they always
            // see the tour, not the Discover page in mid-state.
            emailRedirectTo: `${window.location.origin}/onboarding`,
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
    stashReferralCode();
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
      {/* Big pink→amber→mint orb (matches Discover/Dashboard greeting) */}
      <div
        aria-hidden
        className="pointer-events-none fixed -top-40 -right-32 h-[640px] w-[640px] rounded-full opacity-80 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, hsl(330 85% 70% / 0.65), transparent 55%)," +
            "radial-gradient(circle at 70% 60%, hsl(38 92% 65% / 0.60), transparent 60%)," +
            "radial-gradient(circle at 50% 90%, hsl(160 65% 60% / 0.45), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-40 -left-32 h-[520px] w-[520px] rounded-full opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, hsl(292 84% 70% / 0.55), transparent 60%)," +
            "radial-gradient(circle at 30% 70%, hsl(38 92% 65% / 0.45), transparent 60%)",
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
        <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <img src={rhozelandLogo} alt="Rhozeland" className="h-8 w-8" />
          <span className="font-body text-lg font-bold tracking-tight text-foreground">Rhozeland</span>
        </Link>
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
        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl p-7 sm:p-9">
          {/* Header */}
          <div className="text-center mb-7">
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.6 }}
              className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/5 border border-border/50 mb-4"
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
              transition={{ duration: 0.5, delay: 0.8 }}
              className="font-display text-2xl font-bold text-foreground"
            >
              {isSignUp ? "Join Rhozeland" : "Welcome back"}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.95 }}
              className="mt-1.5 text-sm text-muted-foreground"
            >
              {isSignUp ? "Free forever — takes 10 seconds" : "Sign in to continue"}
            </motion.p>
          </div>

          {/* Referral code — signup only, HIDDEN by default to prevent abuse.
              Users only see this if they came in via ?ref=CODE or click the
              toggle. Don't broadcast that codes exist. */}
          {isSignUp && (
            <div className="mb-4">
              {showReferral ? (
                <div className="space-y-1.5">
                  <Label htmlFor="referral" className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" /> Referral code
                  </Label>
                  <Input
                    id="referral"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="Enter your code"
                    maxLength={32}
                    autoFocus
                    className="h-11 rounded-xl bg-secondary/30 border-border/50 focus:bg-background transition-colors uppercase tracking-wider"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowReferral(true)}
                  className="text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors"
                >
                  Have a referral code?
                </button>
              )}
            </div>
          )}

          {/* Google sign-in — DOMINANT primary action */}
          <Button
            type="button"
            className="w-full h-14 font-semibold rounded-xl text-base shadow-md hover:shadow-lg transition-all bg-foreground text-background hover:bg-foreground/90"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg className="mr-2.5 h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {isSignUp ? "Sign up with Google" : "Sign in with Google"}
          </Button>

          {/* Trust microcopy under primary action */}
          <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-muted-foreground/80">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> No spam
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> No credit card
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Free forever
            </span>
          </div>

          {/* Email path — collapsed by default to keep the form decisive */}
          <AnimatePresence initial={false} mode="wait">
            {!showEmail ? (
              <motion.div
                key="show-email-toggle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-6 text-center"
              >
                <button
                  type="button"
                  onClick={() => setShowEmail(true)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
                >
                  <Mail className="h-3 w-3" /> Or use email instead
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="email-form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/60" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card/80 px-3 text-muted-foreground">or with email</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {isSignUp && (
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name</Label>
                      <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" required className="h-11 rounded-xl bg-secondary/30 border-border/50 focus:bg-background transition-colors" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@studio.com" required className="h-11 rounded-xl bg-secondary/30 border-border/50 focus:bg-background transition-colors" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-11 rounded-xl bg-secondary/30 border-border/50 focus:bg-background transition-colors" />
                  </div>
                  <Button type="submit" variant="outline" className="w-full h-11 font-medium rounded-xl text-sm" disabled={loading}>
                    {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>

                <button
                  type="button"
                  onClick={() => setShowEmail(false)}
                  className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="h-3 w-3" /> Back to one-click sign in
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 text-center">
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        {/* Footer tagline */}
        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          © 2026 Rhozeland · <Link to="/" className="hover:text-foreground transition-colors">Back to home</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default AuthPage;
