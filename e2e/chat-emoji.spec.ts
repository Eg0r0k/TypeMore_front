import { expect, test, type Page } from '@playwright/test'
import { stubDictionaries } from './fixtures/dictionaries'

/**
 * The chat field is a `contenteditable`, not an `<input>`, because an emoji in
 * it is a real `<img>` rather than the text `:name:`. Everything that buys has
 * a matching thing it can break, and these are the three that did:
 *
 *  - the caret, which a flex-laid-out editable strands at the end of the box
 *    the moment you delete what you wrote;
 *  - the clipboard, which has no idea an image means a token unless told;
 *  - the mobile tray, which used to mount a virtualizer for a grid that fits.
 */

async function enterRoom(page: Page, options: { deadIcons?: boolean } = {}): Promise<void> {
  const PIXEL = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
  await page.route('**cdn.discordapp.com**', (route) =>
    options.deadIcons
      ? route.fulfill({ status: 404 })
      : route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL })
  )
  await stubDictionaries(page)
  await page.goto('/servers?mp=loopback')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cookieConsentGiven', 'true')
  })
  await page.reload()
  const createButton = page.getByRole('button', { name: 'Create room' })
  await expect(createButton).toBeEnabled()
  await createButton.click()
  await page.waitForURL('**/room')
  await page.waitForTimeout(500)
}

/** Where the caret is, as an offset into the serialized message. */
const caret = (page: Page): Promise<unknown> =>
  page.evaluate(() => {
    const root = document.querySelector('[data-testid="chat-input"]')
    const selection = window.getSelection()
    if (!root || !selection || selection.rangeCount === 0) return 'no selection'
    const range = selection.getRangeAt(0)
    return {
      inside: root.contains(range.startContainer),
      offset: range.startOffset,
      collapsed: range.collapsed
    }
  })

test('typing then deleting leaves the caret in the field', async ({ page }) => {
  await enterRoom(page)
  const field = page.getByTestId('chat-input')

  await field.click()
  await page.keyboard.type('hello there')
  await page.waitForTimeout(100)
  // Backspace the whole phrase away.
  for (let i = 0; i < 11; i++) await page.keyboard.press('Backspace')
  await page.waitForTimeout(150)
  expect(await field.textContent()).toBe('')
  // The caret is still INSIDE the field, not stranded past the end of it.
  expect(await caret(page)).toMatchObject({ inside: true, collapsed: true })

  // The caret must still be in the field: typing lands here, not nowhere.
  await page.keyboard.type('again')
  await page.waitForTimeout(150)
  expect(await field.textContent()).toBe('again')

  // Select-all + delete, the other way to empty it.
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Backspace')
  await page.keyboard.type('third')
  await page.waitForTimeout(150)
  expect(await field.textContent()).toBe('third')
})

test.describe('clipboard', () => {
  // Reading the clipboard needs a permission Playwright only grants in chromium.
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] })
  test.skip(({ browserName }) => browserName !== 'chromium', 'clipboard permissions are chromium-only')

  test('an emoji copies and pastes as its token', async ({ page }) => {
  await enterRoom(page)
  await page.getByTestId('chat-input').click()
  await page.getByTestId('chat-emoji-button').click()
  await page.waitForTimeout(300)
  await page.getByTestId('emoji-sadge').click()
  await page.waitForTimeout(250)

  // Copy the whole field.
  await page.getByTestId('chat-input').click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Control+C')
  await page.waitForTimeout(150)
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toBe(':sadge:')

  // Paste it back twice: the token must come back as a picture, not as text.
  await page.keyboard.press('End')
  await page.keyboard.press('Control+V')
  await page.waitForTimeout(250)
    expect(await page.locator('[data-testid="chat-input"] img').count()).toBe(2)
  })
})

test('the mobile tray opens without mounting a virtualizer it does not need', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 900 })
  await enterRoom(page)
  await page.getByTestId('chat-emoji-button').click()
  await page.waitForTimeout(500)

  const sheet = page.getByTestId('chat-emoji-sheet')
  await expect(sheet).toBeVisible()
  // Four emoji at eight per row is one row: nothing to virtualise.
  expect(await sheet.locator('.scrollable-wrapper').count()).toBe(0)

  // Still a tray: hard against the bottom edge, full width.
  const box = await sheet.boundingBox()
  expect(Math.round(box!.y + box!.height)).toBe(900)
  expect(Math.round(box!.width)).toBe(420)
})

test('the message cap holds, and shows how much is left', async ({ page }) => {
  await enterRoom(page)
  const field = page.getByTestId('chat-input')
  await field.click()

  // Nothing to say about length until the cap is in sight.
  await page.keyboard.insertText('a'.repeat(150))
  await page.waitForTimeout(150)
  expect(await page.getByTestId('chat-counter').count()).toBe(0)

  await page.keyboard.insertText('b'.repeat(45))
  await page.waitForTimeout(150)
  expect(await page.getByTestId('chat-counter').textContent()).toBe('5')

  // Past the cap the field simply refuses the rest — it never holds a message
  // the server would reject.
  await page.keyboard.insertText('c'.repeat(20))
  await page.waitForTimeout(200)
  expect((await field.textContent())?.length).toBe(200)
  expect(await page.getByTestId('chat-counter').textContent()).toBe('0')
})

test('the server rate limit is reported, and clears itself', async ({ page }) => {
  await enterRoom(page)
  const field = page.getByTestId('chat-input')

  // PROTOCOL.md §3: a bucket of 5, refilled over 2s. Sending flat out drains it.
  for (let i = 0; i < 15; i++) {
    await field.click()
    await page.keyboard.insertText(`spam ${i}`)
    await page.keyboard.press('Enter')
  }

  const error = page.getByTestId('chat-error')
  await expect(error).toBeVisible()
  console.log('ERROR:', await error.textContent())
  expect(await error.textContent()).toContain('too fast')

  // It is a notice, not a permanent state: it goes on its own.
  await expect(error).toBeHidden({ timeout: 8000 })
})

test('an icon that will not load falls back to its token, not to a clipped alt', async ({
  page
}) => {
  // What Firefox did with the animated emoji: the request failed, and an `<img>`
  // in a 1.375rem box rendered its alt `:LICKING:` clipped down to `:L`.
  await enterRoom(page, { deadIcons: true })

  await page.getByTestId('chat-input').click()
  await page.getByTestId('chat-emoji-button').click()
  await page.waitForTimeout(300)
  await page.getByTestId('emoji-LICKING').click()
  await page.waitForTimeout(400)

  const field = page.getByTestId('chat-input')
  const image = field.locator('img')

  // It stays an image — a load failure may be the network having a bad second,
  // and rewriting the message into text would make that permanent. What must
  // hold is that the alt is READABLE: the box is sized by height alone, so a
  // broken icon shows its whole token instead of the first character and a half.
  await expect(image).toHaveAttribute('alt', ':LICKING:')
  const width = await image.evaluate((el) => Math.round(el.getBoundingClientRect().width))
  expect(width).toBeGreaterThan(30)

  // And it still sends as the same message it always was.
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  const logged = page.locator('.message__text img').last()
  await expect(logged).toHaveAttribute('alt', ':LICKING:')
  expect(await logged.evaluate((el) => getComputedStyle(el).display)).toBe('inline-block')
})
