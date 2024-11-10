/**
 * Make color (HEX) lighten and convert it in rgb.
 *
 * @param color - Color to convert in rgb
 * @param amount - Shading coefficient
 * @returns - Shaded color in format rgb
 */
export const lightenColor = (color: string, amount: number): string => {
  color = color.replace(/^#/, '')
  const num = parseInt(color, 16)
  const r = (num >> 16) + Math.round((255 - (num >> 16)) * amount)
  const g = ((num >> 8) & 0x00ff) + Math.round((255 - ((num >> 8) & 0x00ff)) * amount)
  const b = (num & 0x0000ff) + Math.round((255 - (num & 0x0000ff)) * amount)

  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`
}
/**
 * Make color (HEX) darken and convert it in rgb.
 *
 * @param color - Color to convert in rgb
 * @param amount - Shading coefficient
 * @returns - Shaded color in format rgb
 */
export const darkenColor = (color: string, amount: number): string => {
  color = color.replace(/^#/, '')
  const num = parseInt(color, 16)
  const r = Math.max(0, (num >> 16) - 255 * amount)
  const g = Math.max(0, ((num >> 8) & 0x00ff) - 255 * amount)
  const b = Math.max(0, (num & 0x0000ff) - 255 * amount)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`
}
