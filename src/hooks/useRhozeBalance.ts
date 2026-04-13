import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";

export interface RhozeTokenInfo {
  wallet: string;
  balance: number;
  tier: string;
  perks: string[];
  tiers: { name: string; min: number; perks: string[] }[];
}

export const useRhozeBalance = () => {
  const { publicKey, connected } = useWallet();

  return useQuery<RhozeTokenInfo | null>({
    queryKey: ["rhoze-balance", publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return null;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/check-rhoze-balance?wallet=${publicKey.toBase58()}`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (!res.ok) return null;
      return await res.json();
    },
    enabled: connected && !!publicKey,
    staleTime: 30_000,
  });
};
