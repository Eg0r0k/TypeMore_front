/**
 * Clamps a number between min and max values
 */
const clamp = (num: number, min: number, max: number): number => {
  return Math.min(Math.max(num, min), max)
}

/**
 * Converts a hex color value to RGB components
 */
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const cleanHex = hex.replace(/^#/, '')
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  return { r, g, b }
}

/**
 * Converts RGB components to a hex color string with specific rounding
 */
const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (n: number) => {
    const rounded = Math.floor(clamp(n, 0, 255))
    const hex = rounded.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

/**
 * Make color (HEX) lighten and convert it in rgb.
 *
 * @param color - Color to convert in rgb
 * @param amount - Shading coefficient (0 to 1)
 * @returns - Shaded color in format rgb
 */
export const lightenColor = (color: string, amount: number): string => {
  try {
    // Нормализуем значение amount между 0 и 1
    const normalizedAmount = clamp(amount, 0, 1)
    const { r, g, b } = hexToRgb(color)

    const lighten = (value: number): number => {
      return value + Math.floor((255 - value) * normalizedAmount)
    }

    return rgbToHex(lighten(r), lighten(g), lighten(b))
  } catch (error) {
    console.error('Error in lightenColor:', error)
    return '#FFFFFF' // Возвращаем белый как fallback
  }
}

/**
 * Make color (HEX) darken and convert it in rgb.
 *
 * @param color - Color to convert in rgb
 * @param amount - Shading coefficient (0 to 1)
 * @returns - Shaded color in format rgb
 */
export const darkenColor = (color: string, amount: number): string => {
  try {
    // Нормализуем значение amount между 0 и 1
    const normalizedAmount = clamp(amount, 0, 1)
    const { r, g, b } = hexToRgb(color)

    const darken = (value: number): number => {
      return Math.floor(value * (1 - normalizedAmount))
    }

    return rgbToHex(darken(r), darken(g), darken(b))
  } catch (error) {
    console.error('Error in darkenColor:', error)
    return '#000000' // Возвращаем черный как fallback
  }
}

/**
 * Converts a hexadecimal color code to an RGBA color string with the specified opacity.
 *
 * @param color - The hexadecimal color code (e.g., '#RRGGBB').
 * @param opacity - The opacity level (between 0 and 1).
 * @returns  The RGBA color string (e.g., 'rgba(R, G, B, opacity)').
 */
export const getColorWithOpacity = (color: string, opacity: number) => {
  const hex = color.replace('#', '')
  const bigint = parseInt(hex, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}
