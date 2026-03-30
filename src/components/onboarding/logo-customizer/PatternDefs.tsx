import { SectionKey, SectionFill } from "./constants";

interface PatternDefsProps {
  fills: Record<SectionKey, SectionFill>;
}

const PatternDefs = ({ fills }: PatternDefsProps) => {
  const sections: SectionKey[] = ["boxFront", "boxLid", "tag"];

  return (
    <defs>
      {sections.map((key) => {
        const fill = fills[key];
        const pColor = fill.patternColor;

        return (
          <g key={key}>
            {/* Gradient for this section */}
            <linearGradient id={`grad-${key}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={fill.gradientFrom} />
              <stop offset="100%" stopColor={fill.gradientTo} />
            </linearGradient>

            {/* Pattern definitions */}
            {fill.pattern === "dots" && (
              <pattern id={`pat-${key}`} width="10" height="10" patternUnits="userSpaceOnUse">
                <circle cx="5" cy="5" r="1.8" fill={pColor} />
              </pattern>
            )}
            {fill.pattern === "stripes" && (
              <pattern id={`pat-${key}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="8" stroke={pColor} strokeWidth="2.5" />
              </pattern>
            )}
            {fill.pattern === "cross" && (
              <pattern id={`pat-${key}`} width="12" height="12" patternUnits="userSpaceOnUse">
                <line x1="6" y1="2" x2="6" y2="10" stroke={pColor} strokeWidth="1.5" />
                <line x1="2" y1="6" x2="10" y2="6" stroke={pColor} strokeWidth="1.5" />
              </pattern>
            )}
            {fill.pattern === "waves" && (
              <pattern id={`pat-${key}`} width="20" height="10" patternUnits="userSpaceOnUse">
                <path d="M0 5 Q5 0, 10 5 T20 5" fill="none" stroke={pColor} strokeWidth="1.5" />
              </pattern>
            )}
            {fill.pattern === "grid" && (
              <pattern id={`pat-${key}`} width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M10 0 L0 0 0 10" fill="none" stroke={pColor} strokeWidth="1" />
              </pattern>
            )}
          </g>
        );
      })}
    </defs>
  );
};

export default PatternDefs;
