import { expect, test, type Page } from '@playwright/test'
import { stubDictionary, stubReplay } from './fixtures/leaderboards'

/**
 * /profile — the statistics surface over seeded (stubbed) data: the page
 * loads every section, the charts' range filter refetches with the range, the
 * runs table's keyset load-more appends, and a row's watch action opens the
 * replay page. The API is stubbed at the wire, one route per aggregate, so
 * this spec drives exactly the shapes docs/PROFILE.md promises.
 */

const summary = {
  displayName: 'boardsmoke',
  joined: '2026-07-01T10:00:00Z',
  testsStarted: 120,
  testsCompleted: 100,
  restartsPerCompleted: 0.2,
  timeTypingMs: 3_725_000,
  estimatedWordsTyped: 12_345,
  wpm: { highest: 113.1, average: 98.4, averageLast10: 105.2 },
  raw: { highest: 120.5, average: 104.1, averageLast10: 110.9 },
  acc: { highest: 1, average: 0.962, averageLast10: 0.973 },
  consistency: { highest: 0.83, average: 0.71, averageLast10: 0.76 },
  streak: { current: 3, best: 9 },
  languages: [{ lang: 'german', tests: 100 }]
}

const today = new Date().toISOString().slice(0, 10)

const runRow = (id: string) => ({
  id,
  mode: 'words',
  wordCount: 50,
  lang: 'german',
  seed: 1,
  dictHash: 'a1b2c3d4',
  setup: {},
  clientMetrics: {},
  clientScore: {},
  scoreVersion: 2,
  status: 'accepted',
  serverMetrics: { wpm: 103.2, raw: 104, accuracy: 0.97, consistency: 0.76 },
  logBytes: 100,
  restartsSinceLastSubmit: 1,
  createdAt: '2026-07-28T10:00:00Z',
  grade: 'S',
  consistency: 0.76,
  chars: { correct: 240, incorrect: 5, extra: 2, missed: 1 },
  mods: { punctuation: true }
})

const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body)
})

async function stubProfile(
  page: Page
): Promise<{ timeseriesCalls: string[]; runsCalls: string[] }> {
  const timeseriesCalls: string[] = []
  const runsCalls: string[] = []

  await page.route(/\/api\/v1\/me(\?|$)/, (route) =>
    route.fulfill(json({ id: 'u1', displayName: 'boardsmoke', createdAt: summary.joined }))
  )
  await page.route(/\/api\/v1\/profile\/summary(\?|$)/, (route) => route.fulfill(json(summary)))
  await page.route(/\/api\/v1\/profile\/activity(\?|$)/, (route) =>
    route.fulfill(json({ days: [{ date: today, tests: 5, timeMs: 300_000 }] }))
  )
  await page.route(/\/api\/v1\/profile\/histogram(\?|$)/, (route) =>
    route.fulfill(
      json({
        buckets: [
          { wpm: 90, tests: 40 },
          { wpm: 100, tests: 60 }
        ]
      })
    )
  )
  await page.route(/\/api\/v1\/profile\/timeseries(\?|$)/, (route) => {
    timeseriesCalls.push(route.request().url())
    return route.fulfill(
      json({
        days: [{ date: today, timeTypingMs: 600_000, avgWpm: 100, avgAcc: 0.97 }],
        wpmPerHour: 2.5
      })
    )
  })
  await page.route(/\/api\/v1\/profile\/pbs(\?|$)/, (route) =>
    route.fulfill(
      json({
        pbs: [
          {
            bucket: 'time:15000:german:seeded',
            mode: 'time',
            durationMs: 15000,
            lang: 'german',
            textSource: 'seeded',
            runId: 'run-pb',
            score: 1645,
            wpm: 103.2,
            raw: 103.2,
            acc: 1,
            grade: 'SS',
            mods: {},
            achievedAt: '2026-07-20T12:00:00Z'
          }
        ]
      })
    )
  )
  await page.route(/\/api\/v1\/profile\/keyboard(\?|$)/, (route) =>
    route.fulfill(
      json({
        layout: 'qwerty',
        keys: [{ keyId: 'KeyF', count: 500, errorRate: 0.02, avgIntervalMs: 150, intervals: 480 }]
      })
    )
  )
  await page.route(/\/api\/v1\/layouts(\?|$)/, (route) =>
    route.fulfill(
      json({
        layouts: [
          {
            name: 'qwerty',
            label: 'QWERTY',
            keys: [{ id: 'KeyF', row: 0, col: 0, finger: 'index', hand: 'left', chars: ['f', 'F'] }]
          },
          {
            name: 'jcuken',
            label: 'ЙЦУКЕН',
            keys: [{ id: 'KeyF', row: 0, col: 0, finger: 'index', hand: 'left', chars: ['а', 'А'] }]
          }
        ]
      })
    )
  )
  await page.route(/\/api\/v1\/runs(\?|$)/, (route) => {
    const url = route.request().url()
    runsCalls.push(url)
    const cursor = new URL(url).searchParams.get('cursor')
    return route.fulfill(
      cursor === null
        ? json({ runs: [runRow('run-1')], nextCursor: 'cur-1' })
        : json({ runs: [runRow('run-2')] })
    )
  })

  return { timeseriesCalls, runsCalls }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('cookieConsentGiven', 'true')
  })
})

test('the profile loads with seeded data, filters refetch, load-more appends, watch opens the replay', async ({
  page
}) => {
  const { timeseriesCalls, runsCalls } = await stubProfile(page)

  await page.goto('/profile')

  // C1/C2 — identity, counters, the grid.
  await expect(page.getByTestId('profile-nick')).toHaveText('boardsmoke')
  await expect(page.getByTestId('profile-tests-started')).toContainText('120')
  await expect(page.getByTestId('profile-wpm-highest')).toHaveText('113.1')

  // C3 — the calendar has today's cell and the streak line.
  await expect(page.getByTestId('profile-activity-day').first()).toBeVisible()
  await expect(page.getByTestId('profile-streak')).toContainText('3')

  // C4 — the PB card with its race action.
  await expect(page.getByTestId('profile-pb-time:15000:german:seeded')).toContainText('SS')

  // C5 — the charts and the server-computed header stat.
  await expect(page.getByTestId('profile-wpm-per-hour')).toContainText('+2.5')
  await expect(page.getByTestId('profile-daily-chart')).toBeVisible()
  await expect(page.getByTestId('profile-histogram')).toBeVisible()

  // The range filter switches → a refetch with the range's `from`.
  await page.getByTestId('profile-range-week').click()
  await expect.poll(() => timeseriesCalls.some((url) => url.includes('from='))).toBe(true)

  // C9 — the keyboard heatmap drew its key.
  await expect(page.getByTestId('profile-kbd-key-KeyF')).toBeVisible()

  // The runs table: derived cells, then keyset load-more appends the next page.
  await expect(page.getByTestId('profile-run-row')).toHaveCount(1)
  await page.getByTestId('profile-runs-more').click()
  await expect(page.getByTestId('profile-run-row')).toHaveCount(2)
  expect(runsCalls.some((url) => url.includes('cursor=cur-1'))).toBe(true)

  // Open-result → replay: the watch action navigates to the replay page.
  await page.getByTestId('profile-run-replay').first().click()
  await expect(page).toHaveURL(/\/replay\/run-1/)
})

test('a PB card’s race action seats the race on the HOME solo screen', async ({ page }) => {
  await stubProfile(page)
  await stubDictionary(page)
  await stubReplay(page)

  await page.goto('/profile')
  await expect(page.getByTestId('profile-pb-time:15000:german:seeded')).toBeVisible()
  await page.getByTestId('profile-pb-race-time:15000:german:seeded').click()

  // The race lives on home with no chrome of its own: the repeated mark and
  // the ghost-mode pace chip are the whole announcement, and no countdown
  // exists — the ghost waits for the first keystroke.
  await expect(page).toHaveURL(/127\.0\.0\.1:5178\/(\?|$)/)
  await expect(page.getByTestId('race-repeated')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('pace-picker')).toContainText('Ada')
})

test('an anonymous visitor gets a sign-in hint, not a redirect', async ({ page }) => {
  await page.route(/\/api\/v1\/me(\?|$)/, (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: '{"error":"unauthorized"}'
    })
  )
  await page.goto('/profile')
  await expect(page.getByTestId('profile-signin-hint')).toBeVisible()
  await expect(page).toHaveURL(/\/profile/)
})
