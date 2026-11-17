// The backend always works in Kelvin. The screen shows °C, with K as secondary text.

export const KELVIN_OFFSET = 273.15;

export const kToC = (k: number) => k - KELVIN_OFFSET;
export const cToK = (c: number) => c + KELVIN_OFFSET;

/** Fixed decimals, rounding halves up reliably (14.85 -> "14.9"). */
export function fixed(x: number, digits = 1): string {
  const f = 10 ** digits;
  return (Math.round(x * f + 1e-6) / f).toFixed(digits);
}

/** "569.2 °C" from a Kelvin value. */
export const formatC = (k: number, digits = 1) => `${fixed(kToC(k), digits)} °C`;
/** "842.4 K" */
export const formatK = (k: number, digits = 1) => `${fixed(k, digits)} K`;
