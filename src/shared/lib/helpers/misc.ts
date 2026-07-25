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

/**
 * RFC 4122 v4 UUID.
 *
 * `crypto.randomUUID` only exists in secure contexts, so it is missing when the
 * dev server (host 0.0.0.0) is opened over plain http from another device.
 * `crypto.getRandomValues` has no such restriction and covers that case.
 */
export const uuid = (): string => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()

  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
