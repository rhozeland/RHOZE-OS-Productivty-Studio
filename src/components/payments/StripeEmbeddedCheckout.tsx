/**
 * StripeEmbeddedCheckout — generic Embedded Checkout mount.
 * Takes a `fetchClientSecret` callback that hits an edge function returning
 * `{ clientSecret }`. Used by event ticket checkout (and future flows).
 */
import { useMemo } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripe() {
  if (!stripePromise) {
    if (!clientToken) throw new Error("VITE_PAYMENTS_CLIENT_TOKEN missing");
    stripePromise = loadStripe(clientToken);
  }
  return stripePromise;
}

export function getStripeEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("pk_test_") ? "sandbox" : "live";
}

interface Props {
  fetchClientSecret: () => Promise<string>;
}

const StripeEmbeddedCheckoutMount = ({ fetchClientSecret }: Props) => {
  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);
  return (
    <div id="checkout" className="min-h-[420px]">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
};

export default StripeEmbeddedCheckoutMount;
