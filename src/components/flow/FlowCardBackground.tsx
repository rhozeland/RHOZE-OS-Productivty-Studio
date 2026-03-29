import { useMemo } from "react";

interface FlowCardBackgroundProps {
  fileUrl?: string | null;
  category: string;
}

/**
 * Derives a unique set of gradient colors from the content's fileUrl string
 * so every piece of content gets a subtly different animated backdrop.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const CATEGORY_BASE_HUES: Record<string, number> = {
  design: 175,
  music: 340,
  photo: 35,
  video: 280,
  writing: 210,
};

const FlowCardBackground = ({ fileUrl, category }: FlowCardBackgroundProps) => {
  const colors = useMemo(() => {
    const baseHue = CATEGORY_BASE_HUES[category] ?? 175;
    const seed = fileUrl ? hashString(fileUrl) : 0;
    // Derive 3 unique hues offset from the category base
    const h1 = (baseHue + (seed % 40) - 20 + 360) % 360;
    const h2 = (baseHue + ((seed >> 8) % 60) + 30) % 360;
    const h3 = (baseHue + ((seed >> 16) % 50) + 60) % 360;
    return { h1, h2, h3 };
  }, [fileUrl, category]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {fileUrl ? (
        <>
          {/* Blurred image base */}
          <img
            src={fileUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              filter: "blur(90px) saturate(2) brightness(0.8)",
              transform: "scale(1.4)",
            }}
          />
          {/* Animated color orbs derived from content */}
          <div
            className="absolute -top-1/4 -left-1/4 w-[70%] h-[70%] rounded-full opacity-30"
            style={{
              background: `radial-gradient(circle, hsl(${colors.h1} 70% 60% / 0.4), transparent 70%)`,
              animation: "flow-blob-1 14s ease-in-out infinite",
            }}
          />
          <div
            className="absolute -bottom-1/4 -right-1/4 w-[80%] h-[80%] rounded-full opacity-25"
            style={{
              background: `radial-gradient(circle, hsl(${colors.h2} 60% 55% / 0.35), transparent 70%)`,
              animation: "flow-blob-2 18s ease-in-out infinite",
            }}
          />
          <div className="absolute inset-0 bg-background/35" />
        </>
      ) : (
        <>
          {/* No image — full animated gradient blobs */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: `hsl(${colors.h1} 30% 15% / 0.12)` }}
          />
          <div
            className="absolute -top-20 left-[10%] w-[50%] h-[50%] rounded-full blur-3xl opacity-40"
            style={{
              backgroundColor: `hsl(${colors.h1} 65% 55%)`,
              animation: "flow-blob-1 12s ease-in-out infinite",
            }}
          />
          <div
            className="absolute bottom-[5%] right-[5%] w-[55%] h-[55%] rounded-full blur-3xl opacity-30"
            style={{
              backgroundColor: `hsl(${colors.h2} 55% 50%)`,
              animation: "flow-blob-2 16s ease-in-out infinite",
            }}
          />
          <div
            className="absolute top-[40%] left-[40%] w-[40%] h-[40%] rounded-full blur-3xl opacity-20"
            style={{
              backgroundColor: `hsl(${colors.h3} 50% 60%)`,
              animation: "flow-blob-3 20s ease-in-out infinite",
            }}
          />
        </>
      )}
    </div>
  );
};

export default FlowCardBackground;
