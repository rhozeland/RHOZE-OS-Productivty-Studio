import { useEffect, useState } from "react";

interface FlowCardBackgroundProps {
  fileUrl?: string | null;
  category: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  design: "hsl(var(--primary) / 0.15)",
  music: "hsl(340 70% 55% / 0.12)",
  photo: "hsl(35 90% 55% / 0.12)",
  video: "hsl(280 60% 55% / 0.12)",
  writing: "hsl(210 60% 55% / 0.1)",
};

/**
 * Renders a blurred, full-screen backdrop derived from
 * the current card's image or category color.
 */
const FlowCardBackground = ({ fileUrl, category }: FlowCardBackgroundProps) => {
  const fallbackColor = CATEGORY_COLORS[category] || CATEGORY_COLORS.design;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {fileUrl ? (
        <>
          <img
            src={fileUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "blur(80px) saturate(1.8) brightness(0.85)", transform: "scale(1.3)" }}
          />
          <div className="absolute inset-0 bg-background/40" />
        </>
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{ backgroundColor: fallbackColor }}
          />
          <div className="absolute top-10 left-1/4 w-80 h-80 rounded-full blur-3xl animate-pulse"
            style={{ backgroundColor: fallbackColor }} />
          <div className="absolute bottom-10 right-1/4 w-96 h-96 rounded-full blur-3xl"
            style={{ backgroundColor: fallbackColor, opacity: 0.6 }} />
        </>
      )}
    </div>
  );
};

export default FlowCardBackground;
