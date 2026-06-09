/**
 * ConciergePage — public SEO landing for the Concierge SKU at `/concierge`.
 *
 * Pitch: "Tell us the outcome. We scope, staff, and run the project."
 * Pricing: 25% platform fee, $250 minimum, no scoping fee.
 * Primary CTA: opens `<ConciergeIntakeSheet />` (same intake used inside
 * SupportSheet → Work together tab).
 *
 * Kept fully presentational — no business logic beyond opening the sheet.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import LaunchCoinFlowModal from "@/components/launchpad/LaunchCoinFlowModal";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Layers,
} from "lucide-react";

const STEPS = [
  {
    n: "01",
    title: "Tell us the release",
    body:
      "One paragraph. Describe what you want to ship — single, EP, music video, tour, identity. Skip the spec; we'll figure that out.",
  },
  {
    n: "02",
    title: "We scope it within 48h",
    body:
      "A Rhozeland A&R returns a scoped proposal: budget, timeline, and the 1-3 Verified artists & collaborators we'd staff it with. No scoping fee, no obligation.",
  },
  {
    n: "03",
    title: "Approve and we run it",
    body:
      "We project-manage end-to-end: kickoff, milestones, file delivery, on-chain proof of work. You stay in one thread. 25% platform fee on the final budget ($250 min).",
  },
];

const PROOFS = [
  {
    icon: ShieldCheck,
    label: "Verified IP",
    body: "Every deliverable is content-hashed and anchored on Solana — provenance you actually own.",
  },
  {
    icon: Clock,
    label: "48-hour response",
    body: "A real curator reads your brief, not a queue. You hear back within two business days.",
  },
  {
    icon: Layers,
    label: "One thread, one bill",
    body: "We coordinate the team, handle splits and payouts, and settle in fiat or $RHOZE.",
  },
];

export default function ConciergePage() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.title = "Rhozeland A&R — Artist Development & managed releases";
    const desc =
      "Tell us the release. We scope it, staff it with Verified artists, and run it end-to-end. 25% platform fee, $250 min. 48-hour response.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);

    // canonical
    let canon = document.querySelector('link[rel="canonical"]');
    if (!canon) {
      canon = document.createElement("link");
      canon.setAttribute("rel", "canonical");
      document.head.appendChild(canon);
    }
    canon.setAttribute("href", `${window.location.origin}/label-services`);

    // JSON-LD Service schema
    const ldId = "concierge-jsonld";
    document.getElementById(ldId)?.remove();
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.id = ldId;
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Rhozeland A&R",
      provider: {
        "@type": "Organization",
        name: "Rhozeland",
        url: "https://rhozeland.app",
      },
      areaServed: "Global",
      serviceType: "Artist development & managed releases",
      description: desc,
      offers: {
        "@type": "Offer",
        priceSpecification: {
          "@type": "PriceSpecification",
          priceCurrency: "USD",
          price: "250",
          description: "25% platform fee with $250 minimum.",
        },
      },
    });
    document.head.appendChild(ld);

    return () => {
      document.getElementById(ldId)?.remove();
    };
  }, []);

  return (
    <main className="max-w-5xl mx-auto px-4 py-12 md:py-20 space-y-20">
      {/* Hero */}
      <section className="text-center space-y-6">
        <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground border border-border rounded-full px-3 py-1">
          <Sparkles className="h-3 w-3" /> Rhozeland A&R
        </div>
        <h1 className="font-display text-4xl md:text-6xl font-semibold tracking-tight text-foreground">
          Tell us the release.
          <br />
          <span className="text-muted-foreground">We'll run it.</span>
        </h1>
        <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
          Skip the briefs, the back-and-forth, the chasing collaborators. Hand
          us the release you want — single, EP, music video, tour, identity.
          A Rhozeland A&R scopes it, staffs it with Verified artists, and runs
          it end-to-end.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group relative inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_-10px_hsl(200_90%_55%/0.6)] hover:scale-[1.03] active:scale-[0.98] transition-transform overflow-hidden"
            style={{
              backgroundImage:
                "linear-gradient(135deg, hsl(200 90% 55%) 0%, hsl(260 80% 60%) 50%, hsl(170 80% 50%) 100%)",
            }}
          >
            <span
              aria-hidden
              className="absolute inset-0 opacity-60 pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 30%, hsl(0 0% 100% / 0.35), transparent 40%), radial-gradient(circle at 80% 70%, hsl(0 0% 100% / 0.22), transparent 45%)",
              }}
            />
            <Sparkles className="h-4 w-4 relative" />
            <span className="relative">Hand us your release</span>
            <ArrowRight className="h-4 w-4 relative transition-transform group-hover:translate-x-0.5" />
          </button>
          <a
            href="#how"
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            How it works
          </a>
        </div>
        <p className="text-[11px] text-muted-foreground pt-1">
          25% platform fee · $250 minimum · No scoping fee · Response within 48h
        </p>
      </section>

      {/* Proof strip */}
      <section className="grid sm:grid-cols-3 gap-4">
        {PROOFS.map(({ icon: Icon, label, body }) => (
          <div
            key={label}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <Icon className="h-5 w-5 text-foreground mb-3" />
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              {body}
            </p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section id="how" className="space-y-8">
        <header className="text-center space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            How it works
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
            Three steps. Real humans. On-chain receipts.
          </h2>
        </header>
        <ol className="grid md:grid-cols-3 gap-4">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="rounded-2xl border border-border bg-card p-6 space-y-3"
            >
              <span className="font-display text-3xl text-muted-foreground/40">
                {s.n}
              </span>
              <h3 className="text-base font-semibold text-foreground">
                {s.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Pricing */}
      <section className="rounded-3xl border border-border bg-gradient-to-br from-card to-muted/30 p-8 md:p-12 text-center space-y-4">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Pricing
        </p>
        <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
          25% of the final budget. <br />
          <span className="text-muted-foreground">$250 minimum. No scoping fee.</span>
        </h2>
        <ul className="text-sm text-muted-foreground max-w-md mx-auto space-y-2 pt-3">
          {[
            "You approve the scoped budget before anything moves.",
            "Fee is locked at conversion and visible to every collaborator.",
            "Creators get paid in fiat (Stripe) or $RHOZE on milestone approval.",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2 justify-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-left">{line}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Closing CTA */}
      <section className="text-center space-y-5 pb-10">
        <h2 className="font-display text-3xl md:text-4xl font-semibold text-foreground">
          Got an outcome in mind?
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Send us the brief. We'll get back within 48 hours with a scoped
          proposal — budget, timeline, and the creators we'd staff it with.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_-10px_hsl(200_90%_55%/0.6)] hover:scale-[1.03] active:scale-[0.98] transition-transform overflow-hidden"
          style={{
            backgroundImage:
              "linear-gradient(135deg, hsl(200 90% 55%) 0%, hsl(260 80% 60%) 50%, hsl(170 80% 50%) 100%)",
          }}
        >
          <span
            aria-hidden
            className="absolute inset-0 opacity-60 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, hsl(0 0% 100% / 0.35), transparent 40%), radial-gradient(circle at 80% 70%, hsl(0 0% 100% / 0.22), transparent 45%)",
            }}
          />
          <Sparkles className="h-4 w-4 relative" />
          <span className="relative">Hand us your release</span>
          <ArrowRight className="h-4 w-4 relative transition-transform group-hover:translate-x-0.5" />
        </button>
      </section>

      <LaunchCoinFlowModal open={open} onOpenChange={setOpen} project={null} />
    </main>
  );
}
