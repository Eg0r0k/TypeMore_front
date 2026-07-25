/** Why a picked image can be rejected — machine-readable so the caller picks the translation. */
export type ImageReadErrorCode = 'not_an_image' | 'too_large' | 'read_failed'

/** A plain `Error` carrying the reason code. */
export interface ImageReadError extends Error {
  code: ImageReadErrorCode
}

/**
 * Default ceiling for a picked image: 2 MB.
 *
 * The whole config object (this data URL included) is persisted into localStorage,
 * whose quota is ~5 MB. Base64 inflates the payload by ~4/3, so a 2 MB file already
 * costs ~2.7 MB of the budget — anything bigger risks a QuotaExceededError that would
 * silently drop every other setting on write.
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024

const imageError = (code: ImageReadErrorCode, message: string): ImageReadError =>
  Object.assign(new Error(message), { code })

/**
 * Reads a picked image file into a data URL.
 * Rejects non-images and anything over `maxBytes` (localStorage-bound, see MAX_IMAGE_BYTES).
 *
 * @param file - The file coming from an `<input type="file">` pick or a drop.
 * @param maxBytes - Size ceiling in bytes; defaults to {@link MAX_IMAGE_BYTES}.
 * @returns A `data:image/*;base64,...` string.
 * @throws {ImageReadError} with `code` `'not_an_image' | 'too_large' | 'read_failed'`.
 */
export const readImageFile = (file: File, maxBytes: number = MAX_IMAGE_BYTES): Promise<string> => {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(imageError('not_an_image', 'The picked file is not an image'))
  }

  if (file.size > maxBytes) {
    return Promise.reject(imageError('too_large', `The image exceeds ${maxBytes} bytes`))
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(imageError('read_failed', 'The image could not be read'))
    reader.onload = () => {
      // `readAsDataURL` always yields a string, but the union is not narrowed by the API.
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(imageError('read_failed', 'The image could not be read'))
    }

    reader.readAsDataURL(file)
  })
}
