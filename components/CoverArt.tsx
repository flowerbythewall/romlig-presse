/**
 * Cover artwork — generated SVG motifs, so the shop has no image dependencies.
 * Motifs live in a 300 × 410 viewBox and are scaled by preserveAspectRatio.
 */

import type { Product } from "@/lib/types";

/** Used only when a "num" cover has no numeral passed in. */
const NUMERAL_FALLBACK = "0";

type Props = {
  art: Product["art"];
  /** The journal number for "num" covers, or null. */
  numeral?: string | null;
  title?: string;
  author?: string;
  titleSize?: number;
  className?: string;
};

export function CoverArt({
  art,
  numeral = null,
  title,
  author,
  titleSize = 22,
  className,
}: Props) {
  const c = art.fg;
  const s = `stroke="${c}" fill="none" stroke-width="1.2"`;
  const num = numeral ?? (art.shape === "num" ? NUMERAL_FALLBACK : "");

  let motif: React.ReactNode = null;
  switch (art.shape) {
    case "lines":
      motif = Array.from({ length: 14 }, (_, i) => (
        <line key={i} x1="0" x2="300" y1={170 + i * 12} y2={170 + i * 12} stroke={c} fill="none" strokeWidth="1.2" />
      ));
      break;
    case "door":
      motif = (
        <>
          <rect x="105" y="150" width="90" height="190" stroke={c} fill="none" strokeWidth="2" />
          <circle cx="180" cy="250" r="4" fill={c} />
        </>
      );
      break;
    case "contour":
      motif = Array.from({ length: 7 }, (_, i) => (
        <ellipse key={i} cx="160" cy="270" rx={30 + i * 20} ry={16 + i * 11} stroke={c} fill="none" strokeWidth="1.2" />
      ));
      break;
    case "grid": {
      const cells = [];
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 6; y++) {
          cells.push(
            <rect
              key={`${x}-${y}`}
              x={60 + x * 38}
              y={150 + y * 30}
              width="28"
              height="20"
              stroke={c}
              fill="none"
              strokeWidth="1.2"
            />
          );
        }
      }
      motif = <>{cells}</>;
      break;
    }
    case "num":
      motif = (
        <text
          x="150"
          y="330"
          textAnchor="middle"
          fontFamily="Times New Roman"
          fontSize="190"
          fill={c}
        >
          {num}
        </text>
      );
      break;
    case "sun":
      motif = (
        <>
          <circle cx="150" cy="300" r="70" fill={c} />
          <line x1="20" x2="280" y1="300" y2="300" stroke={art.bg} strokeWidth="40" />
        </>
      );
      break;
    case "roof":
      motif = (
        <path d="M60 320 L150 180 L240 320 Z" stroke={c} fill="none" strokeWidth="2" />
      );
      break;
    case "circle":
      motif = (
        <circle
          cx="150"
          cy="265"
          r="85"
          stroke={c}
          fill="none"
          strokeWidth="2"
          strokeDasharray="6 6"
        />
      );
      break;
    case "stair":
      motif = (
        <path d="M50 340 h40 v-30 h40 v-30 h40 v-30 h40 v-30 h40" stroke={c} fill="none" strokeWidth="3" />
      );
      break;
    default:
      motif = null;
  }

  return (
    <div
      className={className}
      style={{ background: art.bg, color: art.fg, position: "relative", overflow: "hidden" }}
      data-testid="cover"
    >
      <svg
        viewBox="0 0 300 410"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        {motif}
      </svg>
      {title ? (
        <div
          className="ct"
          style={{
            position: "absolute",
            left: "8%",
            right: "8%",
            top: "7%",
            fontFamily: "var(--serif)",
            fontSize: titleSize,
            lineHeight: 1,
            letterSpacing: "-.01em",
          }}
        >
          {title}
        </div>
      ) : null}
      {author ? (
        <div
          className="ca"
          style={{
            position: "absolute",
            left: "8%",
            bottom: "6%",
            fontSize: 8,
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          {author}
        </div>
      ) : null}
    </div>
  );
}
