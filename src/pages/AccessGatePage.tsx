/**
 * AccessGatePage — v11 private-build gate.
 *
 * One full-viewport screen shown to every unauthenticated visitor before they
 * can browse Rhoze. Two paths in:
 *  1. Access code (primary) — validated via `redeem_access_code` RPC.
 *     Success sets `rhoze_access_ok=1` in localStorage; router lets them through.
 *  2. Waitlist email (fallback) — inserts into `public.waitlist`.
 *
 * Signed-in users skip this entirely (they already earned access).
 */
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, Check } from "lucide-react";
import rhozelandLogo from "@/assets/rhozeland-logo.png";

export const ACCESS_FLAG = "rhoze_access_ok";
export const hasGateAccess = () => {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(ACCESS_FLAG) === "1";
  } catch {
    return false;
  }
};

const AccessGatePage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"code" | "email" | null>(null);
  const [waitlisted, setWaitlisted] = useState(false);

  useEffect(() => {
    if (hasGateAccess()) navigate("/home", { replace: true });
  }, [navigate]);

  if (loading) return null;
  if (user) return <Navigate to="/home" replace />;

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy("code");
    const { data, error } = await supabase.rpc("redeem_access_code", { _code: code.trim() });
    setBusy(null);
    if (error || !data) {
      toast({ title: "Invalid code", description: "That access code isn't recognised.", variant: "destructive" });
      return;
    }
    try { window.localStorage.setItem(ACCESS_FLAG, "1"); } catch {}
    navigate("/home", { replace: true });
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean || busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    setBusy("email");
    const { error } = await supabase.from("waitlist").insert({ email: clean });
    setBusy(null);
    if (error && !`${error.message}`.toLowerCase().includes("duplicate")) {
      toast({ title: "Something went wrong", description: error.message, variant: "destructive" });
      return;
    }
    setWaitlisted(true);
    setEmail("");
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-[#050505] text-white/90 overflow-hidden px-6">
      {/* Aurora */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-rose-400/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-fuchsia-400/10 blur-[120px]" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[40%] rounded-full bg-amber-500/5 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        <div className="mb-12 flex items-center gap-2 opacity-90">
          <img src={rhozelandLogo} alt="Rhozeland" className="h-8 w-8" />
          <span className="font-body text-base font-bold tracking-tight">Rhozeland</span>
        </div>

        <div className="text-center mb-14 space-y-4">
          <h1 className="font-display text-4xl md:text-5xl italic tracking-tight leading-tight text-white">
            The future of sound is sovereign.
          </h1>
          <p className="text-xs md:text-sm text-white/40 max-w-xs mx-auto leading-relaxed tracking-wide">
            A music-native ecosystem for artists, collectors, and the cultures that connect them. Currently being built in private.
          </p>
        </div>

        <div className="w-full space-y-8">
          {/* Access code */}
          <form onSubmit={submitCode} className="space-y-3">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-white/30 ml-1">
              Insider access
            </label>
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter access code"
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-white/5 border border-white/10 rounded-none py-4 pl-5 pr-24 text-sm placeholder:text-white/20 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all duration-300 font-light tracking-wider"
              />
              <button
                type="submit"
                disabled={!code.trim() || busy !== null}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs uppercase tracking-widest text-white/50 hover:text-white transition-colors flex items-center gap-1 disabled:opacity-30"
              >
                {busy === "code" ? <Loader2 className="h-3 w-3 animate-spin" /> : <>Enter <ArrowRight className="h-3 w-3" /></>}
              </button>
            </div>
          </form>

          {/* Waitlist */}
          <form onSubmit={submitEmail} className="space-y-3">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-white/30 ml-1">
              Join waitlist
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={waitlisted ? "You're on the list." : "Email address"}
                disabled={waitlisted}
                className="w-full bg-transparent border border-white/5 rounded-none py-4 pl-5 pr-24 text-sm placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-all duration-300 font-light disabled:opacity-70"
              />
              <button
                type="submit"
                disabled={!email.trim() || busy !== null || waitlisted}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs uppercase tracking-widest text-white/30 hover:text-white/70 transition-colors flex items-center gap-1 disabled:opacity-40"
              >
                {busy === "email" ? <Loader2 className="h-3 w-3 animate-spin" />
                  : waitlisted ? <Check className="h-3 w-3 text-emerald-400" />
                  : "Submit"}
              </button>
            </div>
          </form>

          <div className="pt-2 text-center">
            <button
              onClick={() => navigate("/auth")}
              className="text-[10px] uppercase tracking-[0.25em] text-white/25 hover:text-white/60 transition-colors"
            >
              Already have an account? Sign in
            </button>
          </div>
        </div>
      </div>

      <footer className="absolute bottom-8 w-full text-center">
        <p className="text-[9px] uppercase tracking-[0.3em] text-white/20">
          Private build · Summer 2026
        </p>
      </footer>
    </div>
  );
};

export default AccessGatePage;
