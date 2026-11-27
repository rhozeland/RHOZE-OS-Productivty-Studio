/**
 * Turns process_wallet_change failures into a next step for the admin
 * reviewing the request.
 */
export function describeWalletChangeError(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  if (error.code === "23505" || message.includes("profiles_wallet_address_key")) {
    return "The requested wallet is now linked to another account. Reject this request.";
  }
  if (message.includes("not been verified")) {
    return "The requested wallet was never verified by its owner. Reject this request.";
  }
  if (message.includes("Linked wallet changed")) {
    return "The user's linked wallet changed after this request was filed. Reject this request.";
  }
  if (message.includes("already processed")) {
    return "This request was already processed.";
  }
  return message || "Couldn't process this wallet change. Please try again.";
}
