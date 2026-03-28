import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const WalletButton = () => {
  return (
    <div className="wallet-adapter-button-wrapper [&_.wallet-adapter-button]:!bg-foreground/10 [&_.wallet-adapter-button]:!text-foreground/70 [&_.wallet-adapter-button]:!text-xs [&_.wallet-adapter-button]:!h-8 [&_.wallet-adapter-button]:!rounded-full [&_.wallet-adapter-button]:!backdrop-blur-sm [&_.wallet-adapter-button]:!border [&_.wallet-adapter-button]:!border-border [&_.wallet-adapter-button]:hover:!bg-foreground/15 [&_.wallet-adapter-button]:!transition-colors">
      <WalletMultiButton />
    </div>
  );
};

export default WalletButton;
