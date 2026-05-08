/**
 * WelcomeModal — first-login welcome popup + quick tour.
 *
 * If the user hasn't picked a username yet, the very first step of this same
 * modal collects it (previously a separate <UsernamePrompt /> dialog — merged
 * here so new users only see ONE popup instead of two).
 */
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe2,
  Coins,
  Handshake,
  ArrowRight,
  Compass,
  Layers,
  MessageSquare,
  Sparkles,
  AtSign,
  Check,
  X,
  Loader2,
  Brush,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const storageKey = (uid: string) => `rhozeland.welcome.seen.${uid}`;

const ROWS = [
  { Icon: Globe2, text: "Discover creators, events, and spaces worldwide." },
  { Icon: Coins, text: "Earn $RHOZE just by being active." },
  { Icon: Handshake, text: "Collaborate, hire, and get hired." },
];

interface TourStep {
  Icon: LucideIcon;
  title: string;
  body: string;
  cta?: { label: string; to: string };
}

const TOUR: TourStep[] = [
  {
    Icon: Compass,
    title: "Discover",
    body: "Your home base. Browse the globe, featured artists, events, spaces, and the marketplace — all in one feed.",
    cta: { label: "Open Discover", to: "/discover" },
  },
  {
    Icon: Sparkles,
    title: "Flow Mode",
    body: "Swipe through the freshest drops. Up to peek the artist, down to comment, right to save — left to pass.",
    cta: { label: "Try Flow", to: "/discover?view=flow" },
  },
  {
    Icon: Layers,
    title: "Creator Pass",
    body: "Hold $RHOZE to unlock tiers (Spark, Bloom, Glow, Play) — lower fees, perks, and rewards.",
    cta: { label: "View Pass", to: "/credits" },
  },
  {
    Icon: MessageSquare,
    title: "Conversations",
    body: "DMs, projects, inquiries, and listings — every thread that matters lives here.",
    cta: { label: "Open Inbox", to: "/messages" },
  },
];

const WelcomeModal = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState<string>("");
  // step semantics:
  //   -2 = role pick (only when profile.primary_role is null)
  //   -1 = username (only when profile has no username yet)
  //    0 = welcome
  //    1..TOUR.length = tour cards
  const [step, setStep] = useState(0);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [needsRole, setNeedsRole] = useState(false);
  const [chosenRole, setChosenRole] = useState<"creator" | "investor" | null>(null);
  const [savingRole, setSavingRole] = useState(false);

  // Username form state
  const [username, setUsername] = useState("");
  const [debounced, setDebounced] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!location.pathname.startsWith("/discover")) return;
    const seen = window.localStorage.getItem(storageKey(user.id));

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, primary_role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const first =
        data?.display_name?.split(" ")[0] ??
        (data as any)?.username ??
        user.email?.split("@")[0] ??
        "there";
      setName(first);

      const missingUsername = !((data as any)?.username);
      const missingRole = !((data as any)?.primary_role);
      // If user has seen the welcome AND has username + role, don't reopen.
      if (seen && !missingUsername && !missingRole) return;

      setNeedsUsername(missingUsername);
      setNeedsRole(missingRole);
      setStep(missingRole ? -2 : missingUsername ? -1 : 0);
      setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, location.pathname]);

  // Debounce + availability check for the username step
  useEffect(() => {
    const t = setTimeout(() => setDebounced(username), 400);
    return () => clearTimeout(t);
  }, [username]);

  const { data: available, isFetching: checking } = useQuery({
    queryKey: ["username-available", debounced],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("check_username_available", {
        _username: debounced,
      });
      if (error) throw error;
      return data as boolean;
    },
    enabled: debounced.length >= 3 && /^[a-zA-Z0-9_]+$/.test(debounced),
  });

  const usernameValid =
    username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_]+$/.test(username);
  const canSaveUsername = usernameValid && available === true && !checking;

  const close = () => {
    if (user) window.localStorage.setItem(storageKey(user.id), "1");
    setOpen(false);
    // Role-based landing — only redirect on first-time completion (when a
    // role was just chosen this session). Returning users won't be yanked.
    if (chosenRole) {
      navigate(chosenRole === "creator" ? "/market" : "/scene");
    }
  };

  const totalSteps = TOUR.length + 1; // welcome + tour cards (role/username steps not counted)
  const isRole = step === -2;
  const isUsername = step === -1;
  const isWelcome = step === 0;
  const isLast = step === TOUR.length;
  const tour = step > 0 ? TOUR[step - 1] : null;

  const saveRole = async (role: "creator" | "investor") => {
    if (!user) return;
    setSavingRole(true);
    setChosenRole(role);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ primary_role: role } as any)
        .eq("user_id", user.id);
      if (error) throw error;
      setNeedsRole(false);
      // Advance: username step if still needed, else welcome.
      setStep(needsUsername ? -1 : 0);
    } catch (err: any) {
      toast.error(err.message || "Failed to save role");
      setChosenRole(null);
    } finally {
      setSavingRole(false);
    }
  };

  const saveUsername = async () => {
    if (!canSaveUsername || !user) return;
    setSavingUsername(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ username: username.toLowerCase() } as any)
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success("Username set 🎉");
      setNeedsUsername(false);
      setStep(0);
    } catch (err: any) {
      toast.error(err.message || "Failed to set username");
    } finally {
      setSavingUsername(false);
    }
  };

  const handleNext = () => {
    if (isRole) return; // role advances via card click, not Next
    if (isUsername) {
      void saveUsername();
      return;
    }
    if (isLast) close();
    else setStep((s) => s + 1);
  };

  const handleCta = () => {
    if (!tour?.cta) return;
    close();
    navigate(tour.cta.to);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // Don't allow dismiss while role or username is required.
        if (isUsername || isRole) return;
        if (v) setOpen(true);
        else close();
      }}
    >
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden border-border/60 bg-card/90 backdrop-blur-2xl"
        onPointerDownOutside={(e) => {
          if (isUsername || isRole) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isUsername || isRole) e.preventDefault();
        }}
      >
        <div className="relative p-7 sm:p-8">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-60"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 50% 0%, hsl(330 81% 60% / 0.18) 0%, transparent 60%)",
            }}
          />
          <div className="relative">
            <p className="font-display text-xl tracking-tight bg-gradient-to-r from-primary via-fuchsia-500 to-amber-500 bg-clip-text text-transparent mb-4 text-center">
              Rhozeland
            </p>

            <AnimatePresence mode="wait">
              {isRole ? (
                <motion.div
                  key="role"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <DialogHeader className="space-y-1.5">
                    <DialogTitle className="font-display text-2xl font-semibold leading-tight text-center">
                      Are you here to <span className="bg-gradient-to-r from-primary via-fuchsia-500 to-amber-500 bg-clip-text text-transparent">create</span> or <span className="bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 bg-clip-text text-transparent">invest</span>?
                    </DialogTitle>
                    <DialogDescription className="text-center text-sm">
                      We'll set up your home room. You can switch any time.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {([
                      {
                        role: "creator" as const,
                        Icon: Brush,
                        title: "Create",
                        body: "Sell work, book studios, take on projects.",
                        chip: "Lands in The Market",
                      },
                      {
                        role: "investor" as const,
                        Icon: TrendingUp,
                        title: "Invest",
                        body: "Discover artists, back their coins, earn $RHOZE.",
                        chip: "Lands in The Scene",
                      },
                    ]).map(({ role, Icon, title, body, chip }) => {
                      const selected = chosenRole === role;
                      return (
                        <button
                          key={role}
                          type="button"
                          disabled={savingRole}
                          onClick={() => void saveRole(role)}
                          className={cn(
                            "group relative rounded-xl border bg-background/40 p-4 text-left transition-all",
                            selected
                              ? "border-foreground bg-foreground text-background"
                              : "border-border hover:border-foreground/40 hover:bg-background/70",
                            savingRole && !selected && "opacity-50",
                          )}
                        >
                          <span
                            className={cn(
                              "inline-flex h-9 w-9 items-center justify-center rounded-lg mb-2.5",
                              selected ? "bg-background/15" : "bg-primary/10",
                            )}
                          >
                            {savingRole && selected ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Icon className={cn("h-4 w-4", selected ? "text-background" : "text-primary")} />
                            )}
                          </span>
                          <div className="font-display text-base font-semibold leading-tight">{title}</div>
                          <div className={cn("text-[11px] mt-1 leading-snug", selected ? "opacity-80" : "text-muted-foreground")}>
                            {body}
                          </div>
                          <div className={cn("mt-2.5 text-[9px] uppercase tracking-[0.18em]", selected ? "opacity-70" : "text-muted-foreground/70")}>
                            {chip}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              ) : isUsername ? (
                <motion.div
                  key="username"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <DialogHeader className="space-y-1.5">
                    <DialogTitle className="font-display text-2xl font-semibold leading-tight text-center flex items-center justify-center gap-2">
                      <AtSign className="h-5 w-5 text-primary" /> Pick your handle
                    </DialogTitle>
                    <DialogDescription className="text-center text-sm">
                      A unique username so others can find you. This can't be easily changed later.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-5 space-y-3">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        @
                      </span>
                      <Input
                        value={username}
                        onChange={(e) =>
                          setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
                        }
                        placeholder="your_username"
                        className="pl-8 pr-10"
                        maxLength={20}
                        autoFocus
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {checking && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {!checking && usernameValid && available === true && (
                          <Check className="h-4 w-4 text-green-500" />
                        )}
                        {!checking && usernameValid && available === false && (
                          <X className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p className={cn(username.length >= 3 && "text-green-600")}>
                        • 3–20 characters
                      </p>
                      <p
                        className={cn(
                          /^[a-zA-Z0-9_]*$/.test(username) &&
                            username.length > 0 &&
                            "text-green-600",
                        )}
                      >
                        • Letters, numbers, and underscores only
                      </p>
                      {usernameValid && available === false && (
                        <p className="text-red-500 font-medium">This username is taken</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : isWelcome ? (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <DialogHeader className="space-y-1.5">
                    <DialogTitle className="font-display text-2xl font-semibold leading-tight text-center">
                      Welcome to Rhozeland, {name}.
                    </DialogTitle>
                    <DialogDescription className="text-center text-sm">
                      The network for creators who show up.
                    </DialogDescription>
                  </DialogHeader>
                  <ul className="mt-6 space-y-2.5 text-left">
                    {ROWS.map(({ Icon, text }, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.08 + i * 0.06 }}
                        className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-3.5 py-2.5"
                      >
                        <span className="h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-primary" />
                        </span>
                        <span className="text-sm text-foreground/90 leading-snug">
                          {text}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              ) : (
                <motion.div
                  key={`tour-${step}`}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                >
                  <DialogHeader className="space-y-1.5">
                    <DialogTitle className="sr-only">Quick tour</DialogTitle>
                    <DialogDescription className="sr-only">
                      Quick tour of important features
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col items-center text-center">
                    <span className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 via-fuchsia-500/15 to-amber-500/15 flex items-center justify-center border border-border/50">
                      {tour && <tour.Icon className="h-6 w-6 text-foreground" />}
                    </span>
                    <h3 className="mt-4 font-display text-2xl font-semibold leading-tight">
                      {tour?.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {tour?.body}
                    </p>
                    {tour?.cta && (
                      <button
                        onClick={handleCta}
                        className="mt-4 text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {tour.cta.label} <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress dots — hidden on role + username steps */}
            {!isUsername && !isRole && (
              <div className="mt-6 flex items-center justify-center gap-1.5">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === step
                        ? "w-5 bg-foreground"
                        : i < step
                          ? "w-1.5 bg-foreground/60"
                          : "w-1.5 bg-foreground/20",
                    )}
                  />
                ))}
              </div>
            )}

            {!isRole && (
              <div className="mt-5 flex flex-col items-center gap-2">
                <Button
                  onClick={handleNext}
                  size="lg"
                  className="w-full gap-2"
                  disabled={isUsername && (!canSaveUsername || savingUsername)}
                >
                  {isUsername ? (
                    savingUsername ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                      </>
                    ) : (
                      <>
                        Continue <ArrowRight className="h-4 w-4" />
                      </>
                    )
                  ) : (
                    <>
                      {isWelcome ? "Take the tour" : isLast ? "Let's go" : "Next"}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
                {!isUsername && (
                  <button
                    onClick={close}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isWelcome ? "Skip for now" : "Skip tour"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeModal;
