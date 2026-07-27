import type { Ref } from 'vue'
import { ref } from 'vue'

/**
 * Copy an element to the clipboard as a PNG.
 *
 * `html2canvas` is loaded on DEMAND, not imported at the top: it is ~200 kB of
 * a CSS-reimplementation that only runs when someone presses the button, and
 * bundling it into the results chunk would make every finished test pay for it.
 *
 * Two things routinely fail here and neither is a bug worth throwing over: the
 * clipboard refuses image writes outside a secure context (and Firefox refuses
 * them outright), and html2canvas parses computed styles itself, so a colour
 * function it does not implement is a runtime error rather than a wrong pixel.
 * The caller gets `false` and tells the player; the page carries on.
 */
export function useScreenshot(target: Ref<HTMLElement | null>) {
  const busy = ref(false)

  async function copy(): Promise<boolean> {
    const element = target.value
    if (!element || busy.value) return false
    busy.value = true
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(element, {
        // The theme's page colour, so the shot is not transparent-turned-black.
        backgroundColor: getComputedStyle(document.documentElement)
          .getPropertyValue('--bg-color')
          .trim(),
        scale: window.devicePixelRatio,
        logging: false
      })
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) return false
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      return true
    } catch (error) {
      console.error('screenshot failed', error)
      return false
    } finally {
      busy.value = false
    }
  }

  return { copy, busy }
}
