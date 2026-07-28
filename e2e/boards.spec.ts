import { expect, test } from '@playwright/test'
import {
  DEFAULT_BUCKETS,
  TIME_15_DE,
  TIME_60_RU,
  WORDS_10_DE,
  row,
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

/** The rail's active item in one of its groups. */
const activeRailItem = (page: import('@playwright/test').Page, testid: string) =>
  page.locator(`[data-testid="${testid}"].board-rail__item--active`)

test('with no ?bucket= the busiest board wins', async ({ page }) => {
  const boards = await stubLeaderboards(page)
  // Guard the fixture itself: the assertion below is only meaningful while the
  // busiest bucket is NOT the first one the catalogue lists.
  expect(boards.busiestBucket).toBe(WORDS_10_DE)
  expect(DEFAULT_BUCKETS[0].bucket).not.toBe(boards.busiestBucket)

  await page.goto('/boards')

  // "German", not "german": the bucket carries the KEY, the rail renders the
  // name the dictionary catalogue publishes for it.
  await expect(activeRailItem(page, 'rail-language')).toHaveText(/German/)
  await expect(activeRailItem(page, 'rail-variation')).toHaveText(/10 words/)
  await expect(page.getByTestId('boards-row')).toHaveCount(2)
  await expect(page.getByTestId('boards-player').first()).toHaveText(/Ada/)

  // And the address is left alone: the selection rewrites a URL that names the
  // WRONG board, never one that names none — an address with no `?bucket=` is
  // not claiming anything false, and replacing it would put a history entry
  // between the visitor and wherever they came from.
  await expect(page.getByTestId('boards-row').first()).toBeVisible()
  expect(new URL(page.url()).searchParams.get('bucket')).toBeNull()
})

test('an unknown ?bucket= falls back to the busiest board and the URL is corrected', async ({
  page
}) => {
  await stubLeaderboards(page)

  await page.goto('/boards?bucket=words:99:klingon:seeded')

  await expect(activeRailItem(page, 'rail-variation')).toHaveText(/10 words/)
  await expect(page.getByTestId('boards-player').first()).toHaveText(/Ada/)
  // A URL that named one board while showing another would lie to whoever
  // copies it next, so it is rewritten to the board actually on screen.
  await expect.poll(() => new URL(page.url()).searchParams.get('bucket')).toBe(WORDS_10_DE)
})

test('a known ?bucket= beats the busiest board', async ({ page }) => {
  const boards = await stubLeaderboards(page)

  await page.goto(`/boards?bucket=${encodeURIComponent(TIME_60_RU)}`)

  // The stub dictionary catalogue publishes german only, so a russian board has
  // no name to render and its rail row falls back to the key — the one case a
  // key is allowed on screen.
  await expect(activeRailItem(page, 'rail-language')).toHaveText(/russian/)
  await expect(activeRailItem(page, 'rail-variation')).toHaveText(/60s/)
  const rows = page.getByTestId('boards-row')
  await expect(rows).toHaveCount(1)
  await expect(rows.getByTestId('boards-player')).toHaveText(/Ivan/)
  expect(new URL(page.url()).searchParams.get('bucket')).toBe(TIME_60_RU)
  expect(boards.rowsOf(TIME_60_RU)[0].displayName).toBe('Ivan')
})

test('picking another variation loads that board', async ({ page }) => {
  await stubLeaderboards(page)
  await page.goto('/boards')
  await expect(page.getByTestId('boards-player').first()).toHaveText(/Ada/)

  await page.locator('[data-testid="rail-variation"][data-variation="time:15000"]').click()

  await expect.poll(() => new URL(page.url()).searchParams.get('bucket')).toBe(TIME_15_DE)
  const rows = page.getByTestId('boards-row')
  await expect(rows).toHaveCount(2)
  await expect(rows.getByTestId('boards-player').first()).toHaveText(/Barbara/)
  await expect(rows.getByTestId('boards-player').nth(1)).toHaveText(/Margaret/)
})

test('a preset this language has no board for is listed muted, not hidden', async ({ page }) => {
  await stubLeaderboards(page)
  await page.goto(`/boards?bucket=${encodeURIComponent(TIME_60_RU)}`)

  // The catalogue's shapes are words:10, time:15 and time:60; russian holds
  // only the 60s board. The other two chips render muted with a zero count —
  // real shapes, no board here yet — and nothing else is invented.
  const chips = page.getByTestId('rail-variation')
  await expect(chips).toHaveCount(3)
  const muted = page.locator('[data-testid="rail-variation"].board-rail__item--muted')
  await expect(muted).toHaveCount(2)
  await expect(muted.first()).toBeDisabled()
  await expect(muted.first()).toHaveText(/0/)
})

test('the language search filters by display name', async ({ page }) => {
  await stubLeaderboards(page)
  await page.goto('/boards')

  await page.getByTestId('rail-language-search').fill('germ')
  const rows = page.getByTestId('rail-language')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toHaveText(/German/)
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

test('jump-to-me windows into the deep board, and the seams close by loading both ways', async ({
  page
}) => {
  // Eight players over four pages; the caller sits at rank 7 — far below what
  // the first page loads.
  const DEEP = 'words:10:german:seeded'
  const deepRows = [
    [row(1, 'Ada', 'run-1', 9_800), row(2, 'Grace', 'run-2', 9_700)],
    [row(3, 'Linus', 'run-3', 9_600), row(4, 'Ken', 'run-4', 9_500)],
    [row(5, 'Edsger', 'run-5', 9_400), row(6, 'Barbara', 'run-6', 9_300)],
    [row(7, 'Margaret', 'run-7', 9_200), row(8, 'Donald', 'run-8', 9_100)]
  ]
  await stubLeaderboards(page, {
    boards: { [DEEP]: deepRows },
    meStatus: 200,
    meRank: 7
  })

  await page.goto('/boards')
  await expect(page.getByTestId('boards-rank')).toHaveText(['1', '2'])
  // The pinned self row already knows the caller's standing.
  await expect(page.getByTestId('boards-self-rank')).toHaveText('#7')

  // The person control fetches the around=me window and lands on the row.
  await page.getByTestId('boards-to-me').click()
  await expect(page.getByTestId('boards-rank')).toHaveText(['1', '2', '6', '7', '8'])
  const selfRow = page.locator('[data-testid="boards-row"].board__row--self')
  await expect(selfRow).toHaveCount(1)
  await expect(selfRow).toContainText('Margaret')
  await expect(selfRow).toBeInViewport()

  // The gap between rank 2 and rank 6 closes from below (the upward keyset
  // continuation), while the tail keeps loading downward as before.
  await page.getByTestId('boards-more-above').click()
  await expect(page.getByTestId('boards-rank')).toHaveText(['1', '2', '4', '5', '6', '7', '8'])
  await page.getByTestId('boards-more-above').click()
  await expect(page.getByTestId('boards-rank')).toHaveText(['1', '2', '3', '4', '5', '6', '7', '8'])
  // Fully tiled: no seam left in either direction.
  await expect(page.getByTestId('boards-more-above')).toHaveCount(0)
  await expect(page.getByTestId('boards-more')).toHaveCount(0)
})

test('an empty catalogue is a state, not a failure', async ({ page }) => {
  await stubLeaderboards(page, { buckets: [] })

  await page.goto('/boards')

  await expect(page.getByTestId('boards-no-boards')).toHaveText('no boards have any entries yet')
  await expect(page.getByTestId('boards-error')).toHaveCount(0)
  await expect(page.getByTestId('rail-languages')).toHaveCount(0)
})

test('a failed board keeps the rail and recovers on retry', async ({ page }) => {
  const boards = await stubLeaderboards(page, { boardStatus: 500 })

  await page.goto('/boards')

  // The board failed, but the means of choosing another one is still there.
  // (A 5xx is retried twice with backoff before the query gives up.)
  const error = page.getByTestId('boards-error')
  await expect(error).toHaveText('could not load this board', { timeout: 20_000 })
  await expect(page.getByTestId('rail-languages')).toBeVisible()
  await expect(page.getByTestId('boards-row')).toHaveCount(0)

  boards.recoverBoards()
  await page.getByTestId('boards-retry').click()

  await expect(page.getByTestId('boards-row')).toHaveCount(2)
  await expect(page.getByTestId('boards-player').first()).toHaveText(/Ada/)
  await expect(error).toHaveCount(0)
})
