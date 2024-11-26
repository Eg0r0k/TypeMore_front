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
