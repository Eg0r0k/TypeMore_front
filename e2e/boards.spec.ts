import { expect, test } from '@playwright/test'
import {
  DEFAULT_BUCKETS,
  TIME_15_DE,
  TIME_60_RU,
  WORDS_10_DE,
  stubDictionary,
  stubLeaderboards
} from './fixtures/leaderboards'

/**
 * `/boards` — the leaderboards page, driven as a visitor sees it.
 *
 * No backend: the catalogue, the paged boards and `/{bucket}/me` are fulfilled
 * by `fixtures/leaderboards.ts` in the same `page.route` style as
 * `fixtures/dictionaries.ts`. Everything else — which bucket wins, what the URL
 * ends up saying, what a failed page leaves on screen — is the real client path.
 *
 * `?bucket=` is always read through `new URL(page.url()).searchParams` so the
 * assertions hold whatever the router chose to percent-encode.
 */

test.beforeEach(async ({ page }) => {
  // The cookie dialog is modal and makes the page inert for clicks; seeding
  // consent before the app boots keeps every test about the boards.
  await page.addInitScript(() => {
    window.localStorage.setItem('cookieConsentGiven', 'true')
  })
  await stubDictionary(page)
})

test('with no ?bucket= the busiest board wins', async ({ page }) => {
  const boards = await stubLeaderboards(page)
  // Guard the fixture itself: the assertion below is only meaningful while the
  // busiest bucket is NOT the first one the catalogue lists.
  expect(boards.busiestBucket).toBe(WORDS_10_DE)
  expect(DEFAULT_BUCKETS[0].bucket).not.toBe(boards.busiestBucket)

  await page.goto('/boards')

  await expect(page.getByTestId('boards-bucket-picker')).toHaveText(/10 words · german/)
  await expect(page.getByTestId('boards-row')).toHaveCount(2)
  await expect(page.getByTestId('boards-player').first()).toHaveText(/Ada/)

  // And the address is left alone: `useBucketSelection` rewrites a URL that
  // names the WRONG board, never one that names none — an address with no
  // `?bucket=` is not claiming anything false, and replacing it would put a
  // history entry between the visitor and wherever they came from.
  await expect(page.getByTestId('boards-row').first()).toBeVisible()
  expect(new URL(page.url()).searchParams.get('bucket')).toBeNull()
})

test('an unknown ?bucket= falls back to the busiest board and the URL is corrected', async ({
  page
}) => {
  await stubLeaderboards(page)

  await page.goto('/boards?bucket=words:99:klingon:seeded')

  await expect(page.getByTestId('boards-bucket-picker')).toHaveText(/10 words · german/)
  await expect(page.getByTestId('boards-player').first()).toHaveText(/Ada/)
  // A URL that named one board while showing another would lie to whoever
  // copies it next, so it is rewritten to the board actually on screen.
  await expect.poll(() => new URL(page.url()).searchParams.get('bucket')).toBe(WORDS_10_DE)
})

test('a known ?bucket= beats the busiest board', async ({ page }) => {
  const boards = await stubLeaderboards(page)

  await page.goto(`/boards?bucket=${encodeURIComponent(TIME_60_RU)}`)

  await expect(page.getByTestId('boards-bucket-picker')).toHaveText(/60s · russian/)
  const rows = page.getByTestId('boards-row')
  await expect(rows).toHaveCount(1)
  await expect(rows.getByTestId('boards-player')).toHaveText(/Ivan/)
  expect(new URL(page.url()).searchParams.get('bucket')).toBe(TIME_60_RU)
  expect(boards.rowsOf(TIME_60_RU)[0].displayName).toBe('Ivan')
})

test('picking another bucket loads that board', async ({ page }) => {
  await stubLeaderboards(page)
  await page.goto('/boards')
  await expect(page.getByTestId('boards-player').first()).toHaveText(/Ada/)

  await page.getByTestId('boards-bucket-picker').click()
  await page.getByRole('option', { name: /15s · german/ }).click()

  await expect.poll(() => new URL(page.url()).searchParams.get('bucket')).toBe(TIME_15_DE)
  const rows = page.getByTestId('boards-row')
  await expect(rows).toHaveCount(2)
  await expect(rows.getByTestId('boards-player').first()).toHaveText(/Barbara/)
  await expect(rows.getByTestId('boards-player').nth(1)).toHaveText(/Margaret/)
})

test('load more appends the next keyset page', async ({ page }) => {
  await stubLeaderboards(page)
  await page.goto('/boards')

  const rows = page.getByTestId('boards-row')
  await expect(rows).toHaveCount(2)

  const more = page.getByTestId('boards-more')
  await expect(more).toBeVisible()
  await more.click()

  // Appended, not replaced: page one's ranks are still above page two's.
  await expect(rows).toHaveCount(4)
  await expect(page.getByTestId('boards-rank')).toHaveText(['1', '2', '3', '4'])
  await expect(page.getByTestId('boards-player').last()).toHaveText(/Ken/)
  // The last page carries no cursor, so the affordance is gone.
  await expect(more).toBeHidden()
})

test('an empty catalogue is a state, not a failure', async ({ page }) => {
  await stubLeaderboards(page, { buckets: [] })

  await page.goto('/boards')

  await expect(page.getByTestId('boards-no-boards')).toHaveText('no boards have any entries yet')
  await expect(page.getByTestId('boards-error')).toHaveCount(0)
  await expect(page.getByTestId('boards-bucket-picker')).toHaveCount(0)
})

test('a failed board keeps the picker and recovers on retry', async ({ page }) => {
  const boards = await stubLeaderboards(page, { boardStatus: 500 })

  await page.goto('/boards')

  // The board failed, but the means of choosing another one is still there.
  // (A 5xx is retried twice with backoff before the query gives up.)
  const error = page.getByTestId('boards-error')
  await expect(error).toHaveText('could not load this board', { timeout: 20_000 })
  await expect(page.getByTestId('boards-bucket-picker')).toBeVisible()
  await expect(page.getByTestId('boards-row')).toHaveCount(0)

  boards.recoverBoards()
  await page.getByTestId('boards-retry').click()

  await expect(page.getByTestId('boards-row')).toHaveCount(2)
  await expect(page.getByTestId('boards-player').first()).toHaveText(/Ada/)
  await expect(error).toHaveCount(0)
})
