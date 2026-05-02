/**
 * MintAddressChip — compact, copyable display of a coin's contract address.
 *
 * In Step 4a (simulated), every coin is auto-assigned a base58-style vanity
 * address ending in "RHOZE". When the on-chain Anchor program is deployed
 * (Step 4b), this same field will hold the real SPL mint pubkey and the
 * Solscan link will become live.
 */
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { isLaunchpadOnChainEnabled, LAUNCHPAD_NETWORK } from "@/lib/launchpad-onchain";
import { cn } from "@/lib/utils";

interface Props {
  address: string | null | undefined;
  size?: "xs" | "sm";
  className?: string;
}

const MintAddressChip = ({ address, size = "sm", className }: Props) => {
  if (!address) return null;
  const onChain = isLaunchpadOnChainEnabled();
  const cluster = LAUNCHPAD_NETWORK === "devnet" ? "?cluster=devnet" : "";
  const url = onChain ? `https://solscan.io/token/${address}${cluster}` : null;

  const truncated = `${address.slice(0, 4)}…${address.slice(-6)}`; // shows the RHOZE suffix

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    toast.success("Address copied");
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/40 px-2 font-mono",
        size === "xs" ? "h-5 text-[10px]" : "h-6 text-[11px]",
        className,
      )}
      title={onChain ? address : `${address} · simulated address — becomes real on-chain at mainnet launch`}
    >
      <span className="text-muted-foreground">CA</span>
      <span className="text-foreground">{truncated}</span>
      <button
        onClick={handleCopy}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Copy contract address"
      >
        <Copy className="h-2.5 w-2.5" />
      </button>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Open on Solscan"
        >
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}
    </span>
  );
};

export default MintAddressChip;
