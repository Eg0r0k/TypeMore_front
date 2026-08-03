/**
 * Generates a random integer within a specified range.
 *
 * @param min - The minimum value (inclusive).
 * @param max - The maximum value (inclusive).
 * @returns A random integer between min and max.
 */
export const randomIntFromRange = (min: number, max: number): number => {
  const normMin = Math.ceil(min)
  const normMax = Math.floor(max)
  return Math.floor(Math.random() * (normMax - normMin + 1) + normMin)
}

/**
 * Constrains a value to the inclusive `[min, max]` range.
 *
 * The ONE clamp in the app: it used to live as a private helper inside the
 * colour code and as four hand-inlined `Math.min(Math.max(...))` expressions
 * (two chart tooltips, the restart counter, the progress driver). `NaN` passes
 * through unchanged, exactly as every inlined form did.
 *
 * @param value - The number to constrain.
 * @param min - Lower bound (inclusive).
 * @param max - Upper bound (inclusive).
 * @returns The value pulled inside the range.
 */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

/** {@link clamp} to the unit range — the shape a fraction/progress value wants. */
export const clamp01 = (value: number): number => clamp(value, 0, 1)

/**
 * Milliseconds → whole seconds, the way every duration-displaying surface
 * rounds. One definition so the solo, match and replay paths cannot drift
 * apart on whether 15 400ms reads as 15 or 16.
 */
export const durationSeconds = (ms: number): number => Math.round(ms / 1000)

/**
 * The thousands separator: U+2009 THIN SPACE, not a plain `' '`.
 *
 * Written as an escape ON PURPOSE. It is invisible in source, so a literal
 * would read as an ordinary space to the next person and get "tidied" into one
 * — which silently widens every count in the UI and breaks any test comparing
 * against the real output. A regular space also lets a number wrap across two
 * lines mid-value; the thin space is the typographically correct choice.
 */
export const THIN_SPACE = '\u2009'

/**
 * Groups thousands with a {@link THIN_SPACE}: `1234567` → `"1 234 567"`.
 *
 * The number is ROUNDED first — this formats COUNTS, and a fractional input
 * would otherwise have its decimals grouped too.
 *
 * @param n - The number to format.
 * @returns The grouped number.
 * @example
 * // returns "12 345" (separated by U+2009)
 * groupThousands(12345)
 */
export const groupThousands = (n: number): string => {
  const digits = String(Math.round(n))
  let out = ''
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += THIN_SPACE
    out += digits[i]
  }
  return out
}
