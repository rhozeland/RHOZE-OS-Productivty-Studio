/**
 * CardPage — public `/card/:creatorId` route. Centers the 1080×1080
 * Backed by Rhozeland card with a Download CTA. Used both as a direct
 * share destination and as the OG-preview source for socials.
 *
 * (True dynamic OG images would need server-side rendering — for now
 * we set the page title + meta description so link previews carry the
 * creator's name and tagline.)
 */
import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Download, Loader2 } from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import BackedCard from "@/components/share/BackedCard";
import { useBackedCardData } from "@/components/share/useBackedCardData";

const CardPage = () => {
  const { creatorId } = useParams<{ creatorId: string }>();
  const { data, isLoading } = useBackedCardData(creatorId);
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!data) return;
    document.title = `${data.displayName} — Backed by Rhozeland`;
    const desc = document.querySelector('meta[name="description"]');
    const content = `Back ${data.displayName} on Rhozeland — ${data.backers} backers and counting.`;
    if (desc) desc.setAttribute("content", content);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = content;
      document.head.appendChild(m);
    }
  }, [data]);

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
    } catch {
      toast.error("Couldn't render the card");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start py-10 px-4 gap-6">
      {isLoading || !data ? (
        <div className="flex items-center gap-2 text-muted-foreground py-20">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading card…
        </div>
      ) : (
        <>
          <div className="w-full max-w-[560px] aspect-square overflow-hidden rounded-3xl border border-border shadow-2xl">
            <div
              className="origin-top-left"
              style={{ transform: "scale(0.5185)" /* 560/1080 */ }}
            >
              <BackedCard ref={cardRef} data={data} />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full max-w-[560px]">
            <Button
              className="flex-1 gap-2"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download PNG
            </Button>
            <Button variant="outline" className="flex-1" asChild>
              <Link to={`/profiles/${data.id}`}>View profile</Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">rhozeland.app</p>
        </>
      )}
    </div>
  );
};

export default CardPage;
