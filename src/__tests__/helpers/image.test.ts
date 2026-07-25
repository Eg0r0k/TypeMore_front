import { readImageFile, MAX_IMAGE_BYTES } from '@/shared/lib/helpers/image'
import { describe, it, expect } from 'vitest'

// Smallest valid 1x1 transparent PNG.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const pngBytes = Uint8Array.from(atob(PNG_BASE64), (char) => char.charCodeAt(0))

describe('readImageFile', () => {
  it('resolves a valid png to a base64 data URL', async () => {
    const file = new File([pngBytes], 'pic.png', { type: 'image/png' })

    const dataUrl = await readImageFile(file)

    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    expect(dataUrl.slice('data:image/png;base64,'.length)).toBe(PNG_BASE64)
  })

  it('rejects a text file with not_an_image', async () => {
    const file = new File(['just words'], 'notes.txt', { type: 'text/plain' })

    await expect(readImageFile(file)).rejects.toMatchObject({ code: 'not_an_image' })
  })

  it('rejects a file with no type at all', async () => {
    const file = new File([pngBytes], 'mystery', { type: '' })

    await expect(readImageFile(file)).rejects.toMatchObject({ code: 'not_an_image' })
  })

  it('rejects an oversized image with too_large', async () => {
    const file = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'huge.png', { type: 'image/png' })

    await expect(readImageFile(file)).rejects.toMatchObject({ code: 'too_large' })
  })

  it('honours a custom maxBytes ceiling', async () => {
    const file = new File([pngBytes], 'pic.png', { type: 'image/png' })

    await expect(readImageFile(file, pngBytes.byteLength - 1)).rejects.toMatchObject({
      code: 'too_large'
    })
    await expect(readImageFile(file, pngBytes.byteLength)).resolves.toContain('base64,')
  })

  it('rejects with a plain Error carrying the code', async () => {
    const file = new File(['nope'], 'notes.txt', { type: 'text/plain' })

    await expect(readImageFile(file)).rejects.toBeInstanceOf(Error)
  })
})
