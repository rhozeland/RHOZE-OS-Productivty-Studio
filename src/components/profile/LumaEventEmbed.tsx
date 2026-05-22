import { ExternalLink, CalendarDays } from "lucide-react";
import { ClaimAttendanceButton } from "@/components/profile/ClaimAttendanceButton";

/**
 * Embeds a Luma event or calendar via lu.ma's official iframe.
 *
 * When `profileId` + `profileUserId` are provided, also renders a phase-1
 * "I went — claim on-chain" button that mints a Solana memo attestation.
 */
export function LumaEventEmbed({
  url,
  title = "Upcoming events",
  className = "",
  profileId,
  profileUserId,
}: {
  url: string;
  title?: string;
  className?: string;
  profileId?: string;
  profileUserId?: string;
}) {
  const isLuma = /^https?:\/\/(www\.)?lu\.ma\//i.test(url);
  if (!isLuma) return null;

  const src = url.includes("?") ? `${url}&compact=true` : `${url}?compact=true`;
  const showClaim = !!(profileId && profileUserId);

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
      {showClaim && (
        <footer className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-border/40 bg-muted/20">
          <p className="text-[11px] text-muted-foreground">
            Went to one of these? Anchor your attendance on Solana + earn $RHOZE.
          </p>
          <ClaimAttendanceButton
            profileId={profileId!}
            profileUserId={profileUserId!}
            lumaUrl={url}
          />
        </footer>
      )}
    </section>
  );
}

export default LumaEventEmbed;
