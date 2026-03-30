import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { SectionKey, SectionFill } from "./constants";
import PatternDefs from "./PatternDefs";

interface LogoSvgProps {
  fills: Record<SectionKey, SectionFill>;
  background: string;
  compact?: boolean;
  onClickSection: (section: SectionKey) => void;
}

function getSectionFill(key: SectionKey, fill: SectionFill): string {
  if (fill.mode === "gradient") return `url(#grad-${key})`;
  return fill.color;
}

function hasPattern(fill: SectionFill): boolean {
  return fill.mode === "pattern" && fill.pattern !== "none";
}

const LogoSvg = forwardRef<SVGSVGElement, LogoSvgProps>(
  ({ fills, background, compact, onClickSection }, ref) => {
    const paths: Record<SectionKey, string> = {
      boxFront:
        "M8.69714 62.3362 L110.377 62.3362 L110.377 155.646 L110.377 184.479 C110.377 190.864 105.201 196.041 98.815 196.041 L20.2595 196.041 C13.8738 196.041 8.69713 190.864 8.69713 184.479 L8.69713 155.646 Z",
      boxLid:
        "M8.69714 62.3362 L59.6897 11.3436 C61.8581 9.17521 64.7991 7.95704 67.8656 7.95704 L164.757 7.95704 L110.377 62.3362 Z",
      tag: "M110.377 155.646 L164.757 101.267 L191.127 127.638 C195.643 132.153 195.643 139.474 191.127 143.99 L153.1 182.017 C148.584 186.533 141.263 186.532 136.748 182.017 Z",
    };

    const sidePanelPath =
      "M110.377 62.3362 L164.757 7.95704 L164.757 101.267 L110.377 155.646 Z";

    const outlinePath =
      "M8.69714 62.3362L8.69713 155.646L8.69713 184.479C8.69713 190.864 13.8738 196.041 20.2595 196.041L98.815 196.041C105.201 196.041 110.377 190.864 110.377 184.479L110.377 155.646M8.69714 62.3362L110.377 62.3362M8.69714 62.3362L59.6897 11.3436C61.8581 9.17521 64.7991 7.95704 67.8656 7.95704L164.757 7.95704M110.377 62.3362L164.757 7.95704M110.377 62.3362L110.377 155.646M164.757 7.95704L164.757 101.267M110.377 155.646L164.757 101.267M110.377 155.646L136.748 182.017C141.263 186.532 148.584 186.533 153.1 182.017L191.127 143.99C195.643 139.474 195.643 132.153 191.127 127.638L164.757 101.267";

    return (
      <svg
        ref={ref}
        width="203"
        height="204"
        viewBox="0 0 203 204"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(compact ? "w-36 h-36" : "w-48 h-48 sm:w-56 sm:h-56")}
      >
        <PatternDefs fills={fills} />

        {/* Background rect */}
        {background !== "transparent" && (
          <rect x="-10" y="-10" width="223" height="224" rx="20" fill={background} />
        )}

        {/* Fillable sections */}
        {(Object.keys(paths) as SectionKey[]).map((key) => (
          <g key={key}>
            <path
              d={paths[key]}
              fill={getSectionFill(key, fills[key])}
              className="cursor-pointer transition-all duration-200 hover:brightness-95"
              onClick={() => onClickSection(key)}
              stroke="none"
            />
            {hasPattern(fills[key]) && (
              <path
                d={paths[key]}
                fill={`url(#pat-${key})`}
                className="cursor-pointer pointer-events-none"
                stroke="none"
              />
            )}
          </g>
        ))}

        {/* Side panel (follows boxLid) */}
        <path
          d={sidePanelPath}
          fill={getSectionFill("boxLid", fills.boxLid)}
          opacity="0.7"
          stroke="none"
        />
        {hasPattern(fills.boxLid) && (
          <path d={sidePanelPath} fill={`url(#pat-boxLid)`} opacity="0.7" stroke="none" />
        )}

        {/* Outline */}
        <path
          d={outlinePath}
          stroke="currentColor"
          strokeWidth="15.8983"
          className="text-foreground"
        />
      </svg>
    );
  }
);

LogoSvg.displayName = "LogoSvg";
export default LogoSvg;
