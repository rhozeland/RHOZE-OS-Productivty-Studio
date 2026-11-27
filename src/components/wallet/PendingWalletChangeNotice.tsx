import type { ReactNode } from "react";
import { usePendingWalletChange } from "@/hooks/usePendingWalletChange";

/**
 * Tells the user their wallet change is waiting for an admin. Renders
 * `fallback` (or nothing) when no change is pending. Only mount it where a
 * wallet is already linked.
 */
const PendingWalletChangeNotice = ({
  className = "text-xs text-muted-foreground",
  fallback = null,
}: {
  className?: string;
  fallback?: ReactNode;
}) => {
  const { data: pending } = usePendingWalletChange();
  if (!pending) return <>{fallback}</>;
  const wallet = pending.requestedWallet;
  return (
    <p className={className}>
      Your change to wallet{" "}
      <span className="font-mono">
        {wallet.slice(0, 6)}…{wallet.slice(-4)}
      </span>{" "}
      is waiting for admin review. This wallet stays linked until it’s
      approved.
    </p>
  );
};

export default PendingWalletChangeNotice;
