/**
 * TreasuryPage — /treasury
 *
 * Fully public transparency page. Three on-chain wallets, fee structure,
 * a recent-activity feed, and Rhozeland's treasury charter. Wallet addresses
 * are configured via VITE_TREASURY_WALLET / VITE_MARKETING_WALLET /
 * VITE_AIRDROP_WALLET — when not set we render a "Not configured yet"
 * placeholder so the page still ships before addresses are public.
 */
import { useState } from "react";
import { Copy, Check, Wallet, Megaphone, Gift, ShieldCheck, RefreshCw, Coins, Activity } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type WalletKind = "treasury" | "marketing" | "airdrop";

interface WalletDef {
  kind: WalletKind;
  title: string;
  description: string;
  icon: typeof Wallet;
  address: string | null;
}

const wallets: WalletDef[] = [
  {
    kind: "treasury",
    title: "Treasury",
    description:
      "Where platform fees accumulate. Funds salaries, infrastructure, and seeds the marketing and airdrop wallets.",
    icon: Wallet,
    address: import.meta.env.VITE_TREASURY_WALLET ?? null,
  },
  {
    kind: "marketing",
    title: "Marketing",
    description:
      "Funds creator acquisition — boosts, featured slots, and matching early backers on high-signal artists.",
    icon: Megaphone,
    address: import.meta.env.VITE_MARKETING_WALLET ?? null,
  },
  {
    kind: "airdrop",
    title: "Airdrop",
    description:
      "Retention and activation. Concierge-approved creators and early backers receive $RHOZE drops from here.",
    icon: Gift,
    address: import.meta.env.VITE_AIRDROP_WALLET ?? null,
  },
];

const truncate = (addr: string) =>
  addr.length <= 12 ? addr : `${addr.slice(0, 4)}…${addr.slice(-4)}`;

const FEE_ROWS = [
  { type: "Subscriptions", fee: "15%", who: "Fan", to: "Treasury" },
  { type: "Self-serve projects", fee: "10–15%", who: "Client", to: "Treasury" },
  { type: "Matched projects", fee: "18%", who: "Client", to: "Treasury" },
  {
    type: "Concierge projects",
    fee: "25–30%",
    who: "Client",
    to: "Treasury + Curator pool",
  },
  { type: "Event tickets", fee: "5%", who: "Attendee", to: "Treasury" },
  { type: "Space bookings", fee: "7%", who: "Client", to: "Treasury" },
  { type: "$RHOZE top-ups", fee: "Spread", who: "Buyer", to: "Treasury" },
];

const CHARTER = [
  {
    title: "30% to buybacks",
    body: "30% of all platform fees fund weekly $RHOZE buybacks. Every transaction supports the token.",
  },
  {
    title: "Transparent on-chain",
    body: "All three wallets are publicly verifiable on Solana. Every inflow and outflow is permanently recorded.",
  },
  {
    title: "Creator-first payouts",
    body: "Creators keep 85–93% of every transaction. Platform fees are taken only on what successfully settles.",
  },
];

const AddressRow = ({ address }: { address: string | null }) => {
  const [copied, setCopied] = useState(false);
  if (!address) {
    return (
      <p className="text-[11px] text-muted-foreground italic">
        Wallet address not configured yet.
      </p>
    );
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 font-mono text-[11px] text-foreground hover:bg-muted/50 transition-colors"
    >
      {truncate(address)}
      {copied ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground" />
      )}
    </button>
  );
};

const WalletCard = ({ w }: { w: WalletDef }) => {
  const Icon = w.icon;
  return (
    <div className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm p-5 space-y-3 flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-display text-base font-semibold text-foreground">
            {w.title}
          </h3>
        </div>
        <AddressRow address={w.address} />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {w.description}
      </p>
      <div className="mt-auto pt-3 border-t border-border/40 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
            USDC
          </p>
          <p className="font-display text-lg font-semibold text-foreground tabular-nums">
            {w.address ? "—" : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
            $RHOZE
          </p>
          <p className="font-display text-lg font-semibold text-foreground tabular-nums">
            {w.address ? "—" : "—"}
          </p>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/70">
        {w.address
          ? "Live balances coming online with the next treasury sync."
          : "Connect the wallet address to display live balances."}
      </p>
    </div>
  );
};

const TreasuryPage = () => {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 md:py-12 space-y-12">
      {/* Header */}
      <header className="space-y-2 max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-card/40 px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          <ShieldCheck className="h-3 w-3" />
          Public ledger
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
          Treasury
        </h1>
        <p className="text-sm text-muted-foreground">
          How platform fees are collected and where they go. Updated in real time.
        </p>
      </header>

      {/* Section 1 — Three wallets */}
      <section className="grid gap-4 md:grid-cols-3">
        {wallets.map((w) => (
          <WalletCard key={w.kind} w={w} />
        ))}
      </section>

      {/* Section 2 — Fee structure */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl md:text-2xl font-semibold tracking-tight text-foreground">
            How fees work
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            One spine: subscriptions recurring, transactional fees on every job.
          </p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                  Revenue type
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                  Fee
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                  Who pays
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                  Where it goes
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FEE_ROWS.map((r) => (
                <TableRow key={r.type} className="border-border/40">
                  <TableCell className="text-sm font-medium text-foreground">
                    {r.type}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-foreground">
                    {r.fee}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.who}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.to}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          30% of all platform fees are used for weekly $RHOZE buybacks. Tokens
          are not a revenue source — they are a discovery signal.
        </p>
      </section>

      {/* Section 3 — Recent activity */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl md:text-2xl font-semibold tracking-tight text-foreground">
              Recent activity
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Only the platform's cut is shown. Client and creator amounts are
              never exposed.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            Live
          </div>
        </div>
        <EmptyState
          icon={Activity}
          title="Activity feed coming online"
          description="The next treasury sync will stream the last ten fee events here. Until then, every inflow remains visible on the wallet addresses above."
          size="lg"
        />
      </section>

      {/* Section 4 — Charter */}
      <section className="space-y-4">
        <h2 className="font-display text-xl md:text-2xl font-semibold tracking-tight text-foreground">
          Treasury Charter
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {CHARTER.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-sm p-5 space-y-2"
            >
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Coins className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-display text-base font-semibold text-foreground">
                {c.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default TreasuryPage;
