/**
 * FlowUnlockGate — no-op passthrough.
 *
 * Per product update: Flow content is no longer locked behind share/back gates.
 * This component remains as a wrapper so existing call sites compile, but it
 * simply renders its children without any overlay.
 */
interface Props {
  artistId?: string | null;
  artistName?: string | null;
  children: React.ReactNode;
}

const FlowUnlockGate = ({ children }: Props) => {
  return <>{children}</>;
};

export default FlowUnlockGate;
