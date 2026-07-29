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
