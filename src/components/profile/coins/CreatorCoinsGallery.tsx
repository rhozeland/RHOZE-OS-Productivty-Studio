/**
 * CreatorCoinsGallery — replaces the standalone "LIVE PROJECT" coin card
 * on the profile. Lists every approved pump.fun token the creator has
 * linked, primary first. Each tile is Birdeye + pump.fun enriched
 * (Market Cap · ATH · % from ATH · 24h vol · Holders · Est. rewards).
 *
 * Empty state for owners → mounts <StartCoinCta /> so the launch path
 * still has a single home.
 */
import { Plus, Coins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useCreatorTokens } from "@/hooks/useCreatorTokens";
import CoinGalleryTile from "./CoinGalleryTile";
import StartCoinCta from "@/components/profile/StartCoinCta";

interface Props {
  userId: string;
  creatorName?: string | null;
  isOwner?: boolean;
  fallbackWallet?: string | null;
}

const CreatorCoinsGallery = ({ userId, creatorName, isOwner, fallbackWallet }: Props) => {
  const navigate = useNavigate();
  const { data: tokens = [], isLoading } = useCreatorTokens(userId);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/60 p-8 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state — owner sees launch CTA, visitors see nothing.
  if (tokens.length === 0) {
    if (!isOwner) return null;
    return <StartCoinCta creatorName={creatorName ?? undefined} />;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
          <Coins className="h-4 w-4 text-emerald-500" />
          {tokens.length > 1 ? "Coins" : "Coin"}
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-normal ml-1">
            · pump.fun
          </span>
        </h2>
        {isOwner && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8 text-xs rounded-full"
            onClick={() => navigate("/settings#token")}
          >
            <Plus className="h-3.5 w-3.5" /> Add coin
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3">
        {tokens.map((t) => (
          <CoinGalleryTile
            key={t.id}
            mint={t.mint_address}
            ticker={t.ticker}
            isPrimary={t.is_primary}
            isOwner={isOwner}
            fallbackWallet={fallbackWallet}
          />
        ))}
      </div>
    </section>
  );
};

export default CreatorCoinsGallery;
