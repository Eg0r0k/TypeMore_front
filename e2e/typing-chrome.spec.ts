import { expect, test, type Page } from '@playwright/test'
import { stubDictionaries } from './fixtures/dictionaries'

/**
 * The shell while a run is under way: the chrome gets out of the way, and the
 * background image is actually behind the app rather than behind an opaque
 * ancestor.
 *
 * All of it hangs off ONE flag (`screen.isTyping`), so these are the tests that
 * say what that flag is for.
 */

/** A 2×2 red PNG — enough to tell "the layer is on screen" from "it is not". */
const RED_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC'

const opacityOf = (page: Page, selector: string): Promise<string> =>
  page.evaluate((s) => getComputedStyle(document.querySelector(s)!).opacity, selector)

const cursorOf = (page: Page): Promise<string> =>
  page.evaluate(() => getComputedStyle(document.body).cursor)

test.beforeEach(async ({ page }) => {
  await stubDictionaries(page)
  await page.goto('/')
  await page.evaluate((img) => {
    localStorage.clear()
    localStorage.setItem('cookieConsentGiven', 'true')
    localStorage.setItem('config', JSON.stringify({ config: { backgroundLocal: img } }))
  }, RED_PNG)
  await page.reload()
  await page.waitForSelector('.settings-bar')
  await page.waitForFunction(
    () =>
      (document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word').length ?? 0) > 0
  )
})

test('nothing opaque is painted over the background image', async ({ page }) => {
  // The bug this pins: the layer is `z-index: -1`, and an ancestor's background
  // is painted AFTER its negative-z-index descendants — so ANY opaque ancestor
  // hides it outright and no z-index on the image can win. `#app` used to carry
  // one in an inline style attribute.
  const opaqueAncestors = await page.evaluate(() => {
    const img = document.querySelector('.custom-background')
    if (!img) return ['the background layer is not rendered at all']
    const named: string[] = []
    let node = img.parentElement
    while (node) {
      const background = getComputedStyle(node).backgroundColor
      // Anything that is not fully transparent covers it.
      if (background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent') {
        named.push(`${node.id || node.className || node.tagName}: ${background}`)
      }
      node = node.parentElement
    }
    return named
  })

  // BODY is allowed and is the point: its background propagates to the canvas,
  // which is painted below everything, image included.
  expect(opaqueAncestors.filter((entry) => !entry.startsWith('BODY'))).toEqual([])
})

test('the header chrome and the footer fade out while typing, and come back', async ({ page }) => {
  expect(await opacityOf(page, '.header__chrome')).toBe('1')
  expect(await opacityOf(page, '.footer')).toBe('1')

  await page.keyboard.press('KeyA')
  await page.waitForTimeout(400)

  expect(await opacityOf(page, '.header__chrome')).toBe('0')
  expect(await opacityOf(page, '.footer')).toBe('0')
  // Faded is not enough: invisible controls that still take clicks and tab
  // stops are worse than visible ones.
  await expect(page.locator('.header__chrome')).toHaveAttribute('inert', '')
  await expect(page.locator('.footer')).toHaveAttribute('inert', '')

  await page.keyboard.press('Control+Enter')
  await page.waitForTimeout(500)
  expect(await opacityOf(page, '.header__chrome')).toBe('1')
  expect(await opacityOf(page, '.footer')).toBe('1')
})

test('the pointer hides while typing, returns on a mouse move, and hides again', async ({
  page
}) => {
  expect(await cursorOf(page)).not.toBe('none')

  await page.keyboard.press('KeyA')
  await page.waitForTimeout(300)
  expect(await cursorOf(page)).toBe('none')

  // A cursor you cannot find is worse than one you did not want: "restart" is
  // a button, and reaching for it must not be a guess.
  await page.mouse.move(400, 400)
  await page.waitForTimeout(150)
  expect(await cursorOf(page)).not.toBe('none')

  await page.keyboard.press('KeyB')
  await page.waitForTimeout(150)
  expect(await cursorOf(page)).toBe('none')
})
