import bs58 from "bs58";

export type TokenTargetType = "project" | "work";

export interface TokenAttachmentTarget {
  targetType: TokenTargetType;
  targetId: string;
}

export interface ApprovedTokenLink extends TokenAttachmentTarget {
  tokenId: string | null;
}

export type RpcInvoker = (
  functionName: string,
  args: Record<string, unknown>,
) => Promise<{ error: unknown | null }>;

export type ExternalAttachmentBody =
  | {
      action: "challenge";
      mintAddress: string;
      targetType: TokenTargetType;
      targetId: string;
      signerWallet: string;
    }
  | { action: "attach"; challengeId: string; signature: string };

export type FunctionInvoker = (
  body: ExternalAttachmentBody,
) => Promise<{ data: any; error: any | null }>;

export type MessageSigner = (message: Uint8Array) => Promise<Uint8Array>;

export class WalletConnectionRequiredError extends Error {
  constructor() {
    super("Connect a Solana wallet that supports message signing, then retry.");
    this.name = "WalletConnectionRequiredError";
  }
}

export class WalletSignatureRejectedError extends Error {
  constructor() {
    super("Wallet signature canceled. No token was attached.");
    this.name = "WalletSignatureRejectedError";
  }
}

export class TokenAttachmentRequestError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "TokenAttachmentRequestError";
    this.status = status;
    this.code = code;
  }
}

const isWalletSignatureRejection = (error: unknown): boolean => {
  const value = error as { code?: unknown; name?: unknown; message?: unknown } | null;
  const code = Number(value?.code);
  const name = String(value?.name ?? "").toLowerCase();
  const message = String(value?.message ?? "").toLowerCase();
  return code === 4001 ||
    name.includes("signmessage") && (name.includes("reject") || name.includes("cancel")) ||
    /user rejected|signature rejected|request rejected|request cancelled|request canceled/.test(message);
};

const requestError = async (error: any): Promise<TokenAttachmentRequestError> => {
  const response = error?.context;
  const status = typeof response?.status === "number" ? response.status : undefined;
  let body: any;
  try {
    const readable = typeof response?.clone === "function" ? response.clone() : response;
    if (typeof readable?.json === "function") body = await readable.json();
  } catch {
    body = undefined;
  }

  const message = status === 410
    ? "The verification challenge expired. Retry to request a fresh challenge."
    : body?.error || error?.message || "External token verification failed. Please try again.";
  return new TokenAttachmentRequestError(message, status, body?.code);
};

export async function linkApprovedCreatorToken(
  rpc: RpcInvoker,
  input: ApprovedTokenLink,
): Promise<void> {
  const { error } = await rpc("link_approved_creator_token", {
    p_token_id: input.tokenId,
    p_target_type: input.targetType,
    p_target_id: input.targetId,
  });
  if (error) throw error;
}

export async function attachExternalPumpToken(input: {
  invoke: FunctionInvoker;
  mintAddress: string;
  target: TokenAttachmentTarget;
  signerWallet: string;
  signMessage: MessageSigner;
}): Promise<{ attached: true; token: { mint: string; name: string; ticker: string; imageUrl: string | null }; target?: unknown }> {
  const { data: challenge, error: challengeError } = await input.invoke({
    action: "challenge",
    mintAddress: input.mintAddress,
    targetType: input.target.targetType,
    targetId: input.target.targetId,
    signerWallet: input.signerWallet,
  });
  if (challengeError) throw await requestError(challengeError);
  if (!challenge?.challengeId || typeof challenge.message !== "string") {
    throw new TokenAttachmentRequestError("The verification service returned an incomplete challenge.");
  }

  let signatureBytes: Uint8Array;
  try {
    // Sign exactly the server-issued challenge. Never reconstruct or normalize it.
    signatureBytes = await input.signMessage(new TextEncoder().encode(challenge.message));
  } catch (error) {
    if (isWalletSignatureRejection(error)) throw new WalletSignatureRejectedError();
    throw error;
  }

  const { data: attached, error: attachError } = await input.invoke({
    action: "attach",
    challengeId: challenge.challengeId,
    signature: bs58.encode(signatureBytes),
  });
  if (attachError) throw await requestError(attachError);
  if (!attached?.attached || !attached?.token?.mint || !attached?.token?.ticker || !attached?.token?.name) {
    throw new TokenAttachmentRequestError("The verification service did not confirm the attachment.");
  }

  return attached as {
    attached: true;
    token: { mint: string; name: string; ticker: string; imageUrl: string | null };
    target?: unknown;
  };
}

export interface QueryInvalidator {
  invalidateQueries: (options: { queryKey: readonly unknown[] }) => Promise<unknown> | unknown;
}

/** Refresh the actual list, detail, and chip query families used by the UI. */
export async function invalidateTokenAttachmentQueries(
  queryClient: QueryInvalidator,
  target: TokenAttachmentTarget,
  mint?: string,
): Promise<void> {
  const keys: (readonly unknown[])[] = target.targetType === "project"
    ? [
        ["project", target.targetId],
        ["projects"],
        ["my-projects"],
        ["bento-projects"],
        ["launcher-projects"],
        ["release"],
        ["release-linked-token"],
        ["project-linked-token"],
      ]
    : [
        ["works"],
        ["works-mine"],
        ["works-registry"],
        ["works-lightbox"],
        ["bento-works"],
        ["launcher-works"],
        ["works-detail", target.targetId],
        ["work-token-chip"],
      ];

  if (mint) keys.push(["creator-token-metrics", mint]);
  await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export const tokenAttachmentErrorMessage = (error: unknown): string => {
  const fallback = "Token attachment failed. Please try again.";
  let message: unknown;

  try {
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === "object" && error !== null) {
      message = (error as { message?: unknown }).message;
    }
  } catch {
    return fallback;
  }

  return typeof message === "string" && message.trim().length > 0 ? message : fallback;
};

export const isWalletSignatureRejectedError = (error: unknown): error is WalletSignatureRejectedError =>
  error instanceof WalletSignatureRejectedError;

export const isWalletConnectionRequiredError = (error: unknown): error is WalletConnectionRequiredError =>
  error instanceof WalletConnectionRequiredError;
