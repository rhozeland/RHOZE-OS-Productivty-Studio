/**
 * ShareCardModal — wraps <BackedCard /> in a dialog with Download (PNG)
 * + Copy link actions. The full-size card is rendered off-screen and
 * scaled inside the dialog for preview; html-to-image snapshots the
 * native 1080×1080 node.
 */
import { useRef, useState } from "react";
import { Download, Link as LinkIcon, Loader2, Check } from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import BackedCard, { type BackedCardVariant } from "./BackedCard";
import { useBackedCardData } from "./useBackedCardData";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorId: string;
  variant?: BackedCardVariant;
}

const ShareCardModal = ({ open, onOpenChange, creatorId, variant }: Props) => {
  const { data, isLoading } = useBackedCardData(open ? creatorId : null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/card/${creatorId}`
      : `/card/${creatorId}`;

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        width: 1080,
        height: 1080,
      });
      const link = document.createElement("a");
      link.download = `rhozeland-${data?.username || creatorId}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Card downloaded");
    } catch (e) {
      toast.error("Couldn't render the card. Try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Backed by Rhozeland</DialogTitle>
          <DialogDescription>
            Share your card on socials. 1080×1080, ready for Instagram, X,
            TikTok, or LinkedIn.
          </DialogDescription>
        </DialogHeader>

        {/* Preview — visually scaled 1080 → ~480px */}
        <div className="relative w-full aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
          {isLoading || !data ? (
            <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div
              className="absolute top-0 left-0 origin-top-left"
              style={{ transform: "scale(0.444)" /* 480/1080 */ }}
            >
              <BackedCard ref={cardRef} data={data} variant={variant} />
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            className="flex-1 gap-2"
            onClick={handleDownload}
            disabled={!data || downloading}
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={handleCopy}
            disabled={!data}
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <LinkIcon className="h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareCardModal;
