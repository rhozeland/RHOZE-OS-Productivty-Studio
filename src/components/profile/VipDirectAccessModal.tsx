/**
 * VipDirectAccessModal — Cameo-style paid VIP messaging tier.
 * Frontend-only flow (no backend wiring): Select → Input → Checkout → Confirmation.
 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Zap, MessageSquare, Video, Camera, Check, Clock, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RequestKind = "dm" | "video" | "photo";
type Step = "select" | "input" | "checkout" | "confirm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorName: string;
}

const OPTIONS: { id: RequestKind; label: string; price: number; Icon: typeof MessageSquare; blurb: string }[] = [
  { id: "dm", label: "Direct Message", price: 25, Icon: MessageSquare, blurb: "A personal written reply." },
  { id: "video", label: "Video Request", price: 120, Icon: Video, blurb: "A custom video shout-out." },
  { id: "photo", label: "Photo Request", price: 60, Icon: Camera, blurb: "A signed personal photo." },
];

const MAX_DM = 280;
const MAX_INSTRUCTIONS = 500;

export const VipDirectAccessModal = ({ open, onOpenChange, creatorName }: Props) => {
  const [step, setStep] = useState<Step>("select");
  const [kind, setKind] = useState<RequestKind | null>(null);
  const [text, setText] = useState("");
  const [countdown, setCountdown] = useState(48 * 3600);

  const selected = useMemo(() => OPTIONS.find((o) => o.id === kind) ?? null, [kind]);
  const maxChars = kind === "dm" ? MAX_DM : MAX_INSTRUCTIONS;

  useEffect(() => {
    if (!open) {
      // Reset shortly after close
      const t = setTimeout(() => {
        setStep("select"); setKind(null); setText(""); setCountdown(48 * 3600);
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (step !== "confirm") return;
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [step]);

  const fmtCountdown = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  const goBack = () => {
    if (step === "input") setStep("select");
    else if (step === "checkout") setStep("input");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 bg-gradient-to-br from-background via-background to-muted/40">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/40">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2">
              {(step === "input" || step === "checkout") && (
                <button
                  type="button"
                  onClick={goBack}
                  className="-ml-1 p-1 rounded-md hover:bg-muted/60 text-muted-foreground"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <DialogTitle className="font-display text-xl tracking-tight flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500 fill-amber-400" />
                Direct Access
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Guaranteed 48-hour response from {creatorName}.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-5 min-h-[320px]">
          <AnimatePresence mode="wait">
            {step === "select" && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.18 }}
                className="space-y-2.5"
              >
                {OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => { setKind(o.id); setStep("input"); }}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card hover:border-foreground/40 hover:shadow-md transition-all text-left group"
                  >
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/15 to-fuchsia-500/15 flex items-center justify-center shrink-0">
                      <o.Icon className="h-5 w-5 text-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{o.label}</p>
                      <p className="text-xs text-muted-foreground">{o.blurb}</p>
                    </div>
                    <span className="font-display text-lg font-bold tabular-nums">${o.price}</span>
                  </button>
                ))}
              </motion.div>
            )}

            {step === "input" && selected && (
              <motion.div
                key="input"
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                <label className="block text-xs uppercase tracking-[0.18em] font-medium text-muted-foreground">
                  {kind === "dm" ? "What do you want to say?" : "What are the instructions for the artist?"}
                </label>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, maxChars))}
                  rows={6}
                  placeholder={kind === "dm" ? "Write your message…" : "e.g. Say happy birthday to Alex, mention their band…"}
                  className="rounded-none border-2 border-foreground/80 focus-visible:ring-0 focus-visible:border-foreground font-mono text-sm resize-none"
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{selected.label} · ${selected.price}</span>
                  <span className="tabular-nums">{text.length} / {maxChars}</span>
                </div>
                <Button
                  className="w-full"
                  disabled={text.trim().length < 4}
                  onClick={() => setStep("checkout")}
                >
                  Continue to Payment
                </Button>
              </motion.div>
            )}

            {step === "checkout" && selected && (
              <motion.div
                key="checkout"
                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Order summary</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{selected.label}</span>
                    <span className="font-display font-bold tabular-nums">${selected.price}.00</span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Input placeholder="Card number" inputMode="numeric" maxLength={19} />
                  <div className="grid grid-cols-2 gap-2.5">
                    <Input placeholder="MM / YY" maxLength={7} />
                    <Input placeholder="CVC" inputMode="numeric" maxLength={4} />
                  </div>
                  <Input placeholder="Name on card" />
                </div>

                <div className="rounded-lg border-l-4 border-amber-500 bg-amber-500/5 px-3 py-2.5 text-[11px] leading-relaxed text-foreground/80">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <Lock className="h-3 w-3" /> All sales are final
                  </p>
                  <p className="mt-1">
                    No refunds unless the artist fails to respond within 48 hours. If the
                    48-hour window is missed, this request expires and your card will not be charged.
                  </p>
                </div>

                <Button
                  className="w-full bg-gradient-to-r from-primary via-fuchsia-500 to-amber-500 text-primary-foreground border-0 hover:opacity-95"
                  onClick={() => setStep("confirm")}
                >
                  Pay ${selected.price}.00
                </Button>
              </motion.div>
            )}

            {step === "confirm" && selected && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="text-center space-y-4 py-2"
              >
                <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-bold tracking-tight">Request Sent.</h3>
                  <p className="text-sm text-muted-foreground mt-1">The 48-hour clock has started.</p>
                </div>
                <div className="mx-auto inline-flex items-center gap-2 rounded-xl border border-border/50 bg-card px-4 py-3">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span className="font-mono text-2xl font-bold tabular-nums">{fmtCountdown(countdown)}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">remaining</span>
                </div>
                <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
                  Back to Profile
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface TriggerProps {
  creatorName: string;
  className?: string;
}

export const VipDirectAccessButton = ({ creatorName, className }: TriggerProps) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "w-full text-left rounded-2xl p-5 bg-gradient-to-br from-zinc-900 via-zinc-800 to-black text-white shadow-lg hover:opacity-95 transition-opacity border border-amber-500/30 relative overflow-hidden",
          className,
        )}
      >
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,theme(colors.amber.400),transparent_60%)]" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-amber-300">
            <Zap className="h-3.5 w-3.5 fill-amber-300" /> VIP DIRECT ACCESS
          </div>
          <p className="font-display text-lg font-bold mt-2">Make a Request</p>
          <p className="text-xs text-white/70 mt-1">Guaranteed 48-hour response or no charge.</p>
        </div>
      </button>
      <VipDirectAccessModal open={open} onOpenChange={setOpen} creatorName={creatorName} />
    </>
  );
};

export default VipDirectAccessButton;
