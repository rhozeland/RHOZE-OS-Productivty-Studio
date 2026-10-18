/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOLANA_ENV?: string;
  readonly VITE_SOLANA_RPC_URL?: string;
  readonly VITE_SOLANA_RHOZE_MINT?: string;
  readonly VITE_SOLANA_TOKEN_PROGRAM_ID?: string;
  readonly VITE_SOLANA_RHOZE_DECIMALS?: string;
  readonly VITE_SOLANA_TREASURY_WALLET?: string;
  readonly VITE_SOLANA_PAYOUT_WALLET?: string;
  readonly VITE_SOLANA_PAYMENTS_ENABLED?: string;
  readonly VITE_SOLANA_CLAIMS_ENABLED?: string;
  readonly VITE_SOLANA_ANCHORING_ENABLED?: string;
}
