/**
 * LaunchpadModeBanner — surfaces whether trades are simulated (Step 4a) or
 * routed through the on-chain Anchor program (Step 4b, once deployed).
 *
 * Copy is written for fans, not traders: "Demo mode" instead of "Simulation
 * mode," no jargon about Anchor programs in the default banner.
 */
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Radio } from "lucide-react";
import { isLaunchpadOnChainEnabled, LAUNCHPAD_NETWORK } from "@/lib/launchpad-onchain";
import { subscribeIdl } from "@/lib/launchpad-idl-store";

const LaunchpadModeBanner = () => {
  const [, force] = useState(0);
  useEffect(() => subscribeIdl(() => force((n) => n + 1)), []);
  const onChain = isLaunchpadOnChainEnabled();

  if (!onChain) {
    return (
      <div className="rounded-lg border-2 border-amber-600/40 dark:border-amber-400/40 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 flex items-start gap-2.5 text-xs">
        <FlaskConical className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="font-semibold text-amber-900 dark:text-amber-100">
            Demo mode — no real money is moving yet
          </div>
          <div className="text-amber-800/90 dark:text-amber-200/85 leading-relaxed">
            We're testing how backing creators works before going live on Solana.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-emerald-600/40 dark:border-emerald-400/40 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2.5 flex items-center gap-2 text-xs">
      <Radio className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300 shrink-0 animate-pulse" />
      <span className="text-emerald-900 dark:text-emerald-100">
        <span className="font-semibold">Live on Solana {LAUNCHPAD_NETWORK}.</span> Backings settle on-chain.
      </span>
      <Badge variant="outline" className="ml-auto text-[10px] uppercase">{LAUNCHPAD_NETWORK}</Badge>
    </div>
  );
};

export default LaunchpadModeBanner;
