import { prepare, layout } from "@chenglou/pretext";

export interface FitOptions {
  min: number;
  max: number;
  /** px letter spacing — must match the CSS letter-spacing of the target. */
  letterSpacing?: number;
}

/**
 * Largest font size in [min, max] whose measured layout fits within maxLines
 * at maxWidth. Binary search; each candidate size needs its own prepare()
 * because the size is baked into the canvas font shorthand.
 */
export function fitFontSize(
  text: string,
  fontForSize: (px: number) => string,
  maxWidth: number,
  maxLines: number,
  lineHeightRatio: number,
  opts: FitOptions,
): number {
  if (!text || maxWidth <= 0) return opts.min;
  let lo = opts.min;
  let hi = opts.max;
  let best = opts.min;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const prepared = prepare(text, fontForSize(mid), {
      letterSpacing: opts.letterSpacing,
    });
    const { lineCount } = layout(
      prepared,
      maxWidth,
      Math.round(mid * lineHeightRatio),
    );
    if (lineCount > 0 && lineCount <= maxLines) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}
