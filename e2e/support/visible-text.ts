import type { Page } from '@playwright/test'

declare global {
  interface Window {
    /** Scrape helper installed by {@link installVisibleText}. */
    __visibleText?: (el: Element | null | undefined) => string
  }
}

/**
 * Install `window.__visibleText` in every document of the page BEFORE its
 * scripts run.
 *
 * The field weaves invisible, seed-derived codepoints into the RENDERED word
 * text (the display layer's anti-scrape measure). An e2e that reads raw
 * `textContent` and types it back is exactly the bot that measure is built to
 * catch: the first invisible "space" desyncs the whole run. Every place that
 * scrapes word text to retype or compare it MUST therefore read it through
 * this helper, which strips the invisible codepoints and nothing else.
 *
 * Registered as an init script (not evaluated ad hoc) so one `beforeEach`
 * covers every navigation in the file; a closure that uses the helper without
 * the install fails loudly with a TypeError instead of silently re-becoming
 * the bot.
 */
export async function installVisibleText(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__visibleText = (el: Element | null | undefined): string =>
      (el?.textContent ?? '').replace(/[\u200b\u2061-\u2064]/g, '')
  })
}
