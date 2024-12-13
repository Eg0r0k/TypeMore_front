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

export const normalDistributionIndex = (
  arrayLength: number,
  mean = arrayLength / 2,
  stdDev = arrayLength / 6
): number => {
  let u = 0,
    v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()

  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  num = mean + stdDev * num

  return Math.max(0, Math.min(arrayLength - 1, Math.round(num)))
}

let seed = 123

export const generateRandomIndex = (arrayLength: number): number => {
  const a = 1664525
  const c = 1013904223
  const m = Math.pow(2, 32)

  seed = (a * seed + c) % m

  return seed % arrayLength
}
