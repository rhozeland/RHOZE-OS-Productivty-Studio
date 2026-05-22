import { ExternalLink, CalendarDays } from "lucide-react";

/**
 * Embeds a Luma event or calendar via lu.ma's official iframe.
 *
 * Accepts any `https://lu.ma/<slug>` or `https://lu.ma/calendar/<id>` URL.
 * Falls back to a quiet link card if the URL isn't a lu.ma URL.
 */
export function LumaEventEmbed({
  url,
  title = "Upcoming events",
  className = "",
}: {
  url: string;
  title?: string;
  className?: string;
}) {
  const isLuma = /^https?:\/\/(www\.)?lu\.ma\//i.test(url);
  if (!isLuma) return null;

  // lu.ma supports `?compact=true` for slim embeds on event pages.
  const src = url.includes("?") ? `${url}&compact=true` : `${url}?compact=true`;

  return (
    <section className={`rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden ${className}`}>
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Open on Luma <ExternalLink className="h-3 w-3" />
        </a>
      </header>
      <div className="bg-background">
        <iframe
          src={src}
          title="Luma events"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allow="fullscreen"
          className="w-full h-[520px] border-0"
        />
      </div>
    </section>
  );
}

export default LumaEventEmbed;
