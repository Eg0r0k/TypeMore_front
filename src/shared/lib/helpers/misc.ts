const G = 0.5772156649
/**
 * Returns a random index based on the logarithm of the array length.
 * This function uses a mathematical approach involving the Euler-Mascheroni constant (G).
 * 
 * @param arrayLen 
 * @returns A random index within the bounds of the array length. 
 */
export const logRandomIndex = (arrayLen: number): number => {
  const len = arrayLen
  const M = Math.log(len) + G
  const rand = Math.random()
  const h = Math.exp(rand * M - G)
  const W = Math.ceil(h)
  return W - 1
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

