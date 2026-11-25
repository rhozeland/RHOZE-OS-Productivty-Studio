import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  attachExternalPumpToken,
  invalidateTokenAttachmentQueries,
  linkApprovedCreatorToken,
  WalletConnectionRequiredError,
  type TokenAttachmentTarget,
} from "@/lib/token-attachment";

/** Shared entry point for both approved-token and creator-signed mint links. */
export const useTokenAttachment = () => {
  const { user } = useAuth();
  const { connected, publicKey, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const queryClient = useQueryClient();
  const inFlight = useRef(false);
  const [isPending, setIsPending] = useState(false);

  const runExclusive = useCallback(async <T,>(operation: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setIsPending(true);
    try {
      return await operation();
    } finally {
      inFlight.current = false;
      setIsPending(false);
    }
  }, []);

  const assertAuthenticated = useCallback(() => {
    if (!user) throw new Error("Sign in before attaching a token.");
  }, [user]);

  const refresh = useCallback(async (target: TokenAttachmentTarget, mint?: string) => {
    await invalidateTokenAttachmentQueries(queryClient, target, mint);
  }, [queryClient]);

  const attachApproved = useCallback(async (input: TokenAttachmentTarget & { tokenId: string }) =>
    runExclusive(async () => {
      assertAuthenticated();
      await linkApprovedCreatorToken((supabase as any).rpc.bind(supabase), {
        tokenId: input.tokenId,
        targetType: input.targetType,
        targetId: input.targetId,
      });
      await refresh(input);
      return true;
    }), [assertAuthenticated, refresh, runExclusive]);

  const attachExternal = useCallback(async (input: TokenAttachmentTarget & { mintAddress: string }) =>
    runExclusive(async () => {
      assertAuthenticated();
      if (!connected || !publicKey || !signMessage) {
        setVisible(true);
        throw new WalletConnectionRequiredError();
      }

      const result = await attachExternalPumpToken({
        mintAddress: input.mintAddress,
        target: input,
        signerWallet: publicKey.toBase58(),
        signMessage,
        invoke: (body) => supabase.functions.invoke("attach-external-pump-token", { body }),
      });
      await refresh(input, result.token.mint);
      return result;
    }), [assertAuthenticated, connected, publicKey, refresh, runExclusive, setVisible, signMessage]);

  const unlink = useCallback(async (target: TokenAttachmentTarget) =>
    runExclusive(async () => {
      assertAuthenticated();
      await linkApprovedCreatorToken((supabase as any).rpc.bind(supabase), {
        tokenId: null,
        targetType: target.targetType,
        targetId: target.targetId,
      });
      await refresh(target);
      return true;
    }), [assertAuthenticated, refresh, runExclusive]);

  return { attachApproved, attachExternal, unlink, isPending };
};

export type TokenAttachmentController = ReturnType<typeof useTokenAttachment>;
