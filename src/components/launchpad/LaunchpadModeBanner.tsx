/**
 * LaunchpadModeBanner — surfaces whether trades are simulated (Step 4a) or
 * routed through the on-chain Anchor program (Step 4b, once deployed).
 */
import { Badge } from "@/components/ui/badge";
import { Beaker, Radio } from "lucide-react";
import { isLaunchpadOnChainEnabled, LAUNCHPAD_NETWORK } from "@/lib/launchpad-onchain";

const LaunchpadModeBanner = () => {
  const onChain = isLaunchpadOnChainEnabled();

  if (!onChain) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-center gap-2 text-xs">
        <Beaker className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span className="text-amber-200/90">
          <span className="font-semibold">Simulation mode.</span> The bonding curve runs server-side — no real SOL is moved. The Anchor program ships in 4b.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 flex items-center gap-2 text-xs">
      <Radio className="h-3.5 w-3.5 text-emerald-500 shrink-0 animate-pulse" />
      <span className="text-emerald-200/90">
        <span className="font-semibold">Live on Solana {LAUNCHPAD_NETWORK}.</span> Trades settle on-chain via the Rhozeland Launchpad program.
      </span>
      <Badge variant="outline" className="ml-auto text-[10px] uppercase">{LAUNCHPAD_NETWORK}</Badge>
    </div>
  );
};

export default LaunchpadModeBanner;
