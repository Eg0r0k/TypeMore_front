/**
 * Give happy-dom elements a size.
 *
 * happy-dom does no layout, so `offsetWidth` / `offsetHeight` are 0 for every
 * element. A virtualized list reads exactly those to decide how many rows fit,
 * and 0 means "none" — so any component that renders through
 * `VirtualScrollable` mounts empty in a unit test unless the size is stubbed.
 * That is a property of the test environment, not of the component: the same
 * list renders fine in Playwright, where there is real layout.
 *
 * Returns the restore function, so a suite that stubs is obliged to hand the
 * prototype back — leaking a global getter into the next file is the kind of
 * cross-test coupling that shows up as an unrelated failure days later.
 */
const OFFSET_PROPS = ['offsetWidth', 'offsetHeight'] as const

export const stubElementSize = (width = 320, height = 480): (() => void) => {
  const originals = OFFSET_PROPS.map(
    (prop) => [prop, Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop)] as const
  )
  const sizes: Record<(typeof OFFSET_PROPS)[number], number> = {
    offsetWidth: width,
    offsetHeight: height
  }

  for (const prop of OFFSET_PROPS) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get: () => sizes[prop]
    })
  }

  return () => {
    for (const [prop, descriptor] of originals) {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, prop, descriptor)
      else Reflect.deleteProperty(HTMLElement.prototype, prop)
    }
  }
}
