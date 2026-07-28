import { expect, test } from '@playwright/test'
import {
  QUOTE_BUCKET,
  QUOTE_ID,
  QUOTE_SOURCE,
  QUOTE_TEXT,
  row,
  stubDictionary,
  stubLeaderboards,
  stubQuotes
} from './fixtures/leaderboards'

/**
 * The quotes side of `/boards`: source switch → picker → quote page → board,
 * and the regression that motivated it — a quote board link must open the
 * quote board even while the catalogue has never heard of it.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('cookieConsentGiven', 'true')
  })
  await stubDictionary(page)
  await stubQuotes(page)
})

test('quotes → picker → quote page → board', async ({ page }) => {
  await stubLeaderboards(page, {
    boards: {
      [QUOTE_BUCKET]: [[{ ...row(1, 'Ada', 'run-ada', 12_480), source: QUOTE_SOURCE }]]
    }
  })
  await page.goto('/boards')

  await page.locator('[data-testid="rail-source"][data-source="quotes"]').click()

  // The picker: metadata only — attribution, band, length. Never the text.
  const rows = page.getByTestId('quote-picker-row')
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText(QUOTE_SOURCE)

  // The length filter narrows the walk.
  await page.locator('[data-testid="rail-group"][data-group="short"]').click()
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Franz Kafka')
  await page.locator('[data-testid="rail-group"][data-group="all"]').click()
  await expect(rows).toHaveCount(2)

  // Picking one opens ITS page: attribution as the headline, the text under
  // it, the board below.
  await rows.first().click()
  await expect(page.getByTestId('quote-board-source')).toHaveText(QUOTE_SOURCE)
  await expect(page.getByTestId('quote-board-text')).toContainText(QUOTE_TEXT.slice(0, 30))
  await expect(page.getByTestId('boards-row')).toHaveCount(1)
  expect(new URL(page.url()).searchParams.get('bucket')).toBe(QUOTE_BUCKET)
})

/**
 * REGRESSION — the "open this quote's leaderboard" button. The results screen
 * links here seconds after a run, before the replay worker accepted anything,
 * so the catalogue does NOT list this board. The old page validated the key
 * against the catalogue and silently rewrote the URL to the busiest language
 * board; the button "did not open the board".
 */
test('a quote link opens its board even before the board is in the catalogue', async ({ page }) => {
  // DEFAULT_BUCKETS: language boards only — the quote board is unlisted.
  await stubLeaderboards(page)

  await page.goto(`/boards?bucket=${QUOTE_BUCKET}`)

  await expect(page.getByTestId('quote-board-source')).toHaveText(QUOTE_SOURCE)
  // An unlisted board is an EMPTY board, not a redirect.
  await expect(page.getByTestId('boards-empty')).toBeVisible()
  expect(new URL(page.url()).searchParams.get('bucket')).toBe(QUOTE_BUCKET)
  // And the rail says where you are: quotes is the active source.
  await expect(
    page.locator('[data-testid="rail-source"][data-source="quotes"].board-rail__item--active')
  ).toBeVisible()
})
