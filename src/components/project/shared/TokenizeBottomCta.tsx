/**
 * Full-width dark gradient CTA pinned at the bottom of every project tab.
 * Opens the 3-screen LaunchCoinFlowModal — same flow as Studio's "Launch a
 * Coin" card and TokenizeProjectCta's "Get help launching" button.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Copy } from "lucide-react";
import { toast } from "sonner";
import { pumpFunDetailsJson } from "@/lib/pump-fun";
import LaunchCoinFlowModal from "@/components/launchpad/LaunchCoinFlowModal";

interface Props {
  project: {
    id: string;
    title: string;
    vision?: string | null;
    description?: string | null;
    tokenize_ready?: boolean;
    is_public?: boolean;
  };
  linkedTokenTicker?: string | null;
  /** Public surfaces only render the CTA when the release is opted-in to public mode. */
  publicView?: boolean;
}

const TokenizeBottomCta = ({ project, linkedTokenTicker, publicView }: Props) => {
  const [open, setOpen] = useState(false);

  if (linkedTokenTicker) return null; // already coined
  if (publicView && !project.is_public) return null;

  const headline = project.tokenize_ready
    ? "A&R flagged this release for tokenization"
    : "Turn this release into a coin";

  const sub = project.tokenize_ready
    ? "Launch on pump.fun with your title, vision, and cover pre-filled. Holders unlock private updates and earn alongside you."
    : "When the time's right, tokenize this release so supporters can hold a piece and earn alongside you.";

  const description = project.vision ?? project.description ?? undefined;

  return (
    <>
      <div className="mt-10 rounded-2xl overflow-hidden relative bg-gradient-to-br from-black via-zinc-900 to-black border border-white/10">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 20% 30%, hsl(292 84% 61% / 0.4), transparent 50%), radial-gradient(circle at 80% 70%, hsl(330 85% 60% / 0.35), transparent 50%)",
          }}
        />
        <div className="relative p-6 md:p-10 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-300 font-semibold mb-2">
              <Sparkles className="h-3 w-3" /> Tokenize
            </div>
            <h3 className="text-xl md:text-2xl font-display font-bold text-white">{headline}</h3>
            <p className="mt-2 text-sm text-white/70 max-w-xl">{sub}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Button
              size="lg"
              className="gap-1.5 bg-white text-black hover:bg-white/90"
              onClick={() => setOpen(true)}
            >
              <Sparkles className="h-4 w-4" />
              Launch on pump.fun
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="gap-1.5 bg-transparent text-white border-white/20 hover:bg-white/10 hover:text-white"
              onClick={async () => {
                await navigator.clipboard.writeText(
                  pumpFunDetailsJson({ name: project.title, description }),
                );
                toast.success("Coin details copied");
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Copy details
            </Button>
          </div>
        </div>
      </div>

      <LaunchCoinFlowModal
        open={open}
        onOpenChange={setOpen}
        project={{ id: project.id, title: project.title, description }}
        backHref={`/projects/${project.id}`}
      />
    </>
  );
};

export default TokenizeBottomCta;
