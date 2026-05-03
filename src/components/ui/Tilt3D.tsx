/**
 * Tilt3D — mouse-tracked 3D parallax wrapper with a moving shine highlight.
 *
 * Used by CreatorPassCard + TicketDetailPage to give the cards a
 * "captured collectible" feel. Pure CSS transforms (no canvas / no WebGL)
 * so it stays cheap. Tap the card on touch to trigger a brief shine sweep.
 */
import { useRef, useState, ReactNode, MouseEvent, TouchEvent } from "react";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  className?: string;
  maxTilt?: number; // degrees
  glare?: boolean;
}

const Tilt3D = ({ children, className, maxTilt = 12, glare = true }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ rx: number; ry: number; gx: number; gy: number; active: boolean }>({
    rx: 0, ry: 0, gx: 50, gy: 50, active: false,
  });

  const update = (cx: number, cy: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (cx - r.left) / r.width;  // 0..1
    const py = (cy - r.top) / r.height;
    const ry = (px - 0.5) * 2 * maxTilt;        // rotateY follows X
    const rx = -(py - 0.5) * 2 * maxTilt;       // rotateX inverse Y
    setStyle({ rx, ry, gx: px * 100, gy: py * 100, active: true });
  };

  const reset = () => setStyle({ rx: 0, ry: 0, gx: 50, gy: 50, active: false });

  return (
    <div
      ref={ref}
      onMouseMove={(e: MouseEvent) => update(e.clientX, e.clientY)}
      onMouseLeave={reset}
      onTouchMove={(e: TouchEvent) => {
        const t = e.touches[0];
        if (t) update(t.clientX, t.clientY);
      }}
      onTouchEnd={reset}
      style={{ perspective: 1200 }}
      className={cn("relative", className)}
    >
      <div
        className="relative will-change-transform transition-transform duration-200 ease-out"
        style={{
          transform: `rotateX(${style.rx}deg) rotateY(${style.ry}deg) ${style.active ? "scale(1.015)" : "scale(1)"}`,
          transformStyle: "preserve-3d",
        }}
      >
        {children}
        {glare && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-overlay transition-opacity duration-200"
            style={{
              opacity: style.active ? 0.6 : 0,
              background: `radial-gradient(circle at ${style.gx}% ${style.gy}%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.0) 45%)`,
            }}
          />
        )}
        {glare && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden"
            style={{
              background: `linear-gradient(${105 + (style.gx - 50) * 0.6}deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)`,
              opacity: style.active ? 1 : 0.35,
              transition: "opacity 200ms ease-out",
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Tilt3D;
