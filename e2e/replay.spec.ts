import { expect, test, type Response } from '@playwright/test'
import {
  DEFAULT_RUN_ID,
  WORDS_10_DE,
  stubDictionary,
  stubLeaderboards,
  stubReplay
} from './fixtures/leaderboards'

/**
 * `/replay/:runId` — the public replay, and the TWO-REQUEST path it is built on.
 *
 * `GET /runs/{id}/replay` carries metadata only; the event log is a second
 * request whose body is the STORED GZIP BLOB (`Content-Encoding: gzip`), so the
 * server never gunzips it and the client never base64-decodes anything. The
 * fixture gzips for real, and the headline test below reads the wire back off
 * `page.on('request')` / `page.on('response')` to prove all three claims:
 * two requests, gzip on the wire, no base64 anywhere.
 */

/** A body that is one long base64 blob — what the design deliberately avoids. */
const BASE64_BLOB = /^[A-Za-z0-9+/\s]{200,}={0,2}$/

const REPLAY_URL = /\/api\/v1\/runs\/[^/?]+\/replay/

/**
 * True if any string ANYWHERE in the parsed body is a base64-looking payload.
 * Recursive on purpose: "no base64" has to hold for a nested `log` field too,
 * not just for a body that is nothing but a blob.
 */
const carriesBase64Payload = (value: unknown): boolean => {
  if (typeof value === 'string') return BASE64_BLOB.test(value)
  if (Array.isArray(value)) return value.some(carriesBase64Payload)
  if (value !== null && typeof value === 'object') {
    return Object.values(value).some(carriesBase64Payload)
  }
  return false
}

test.beforeEach(async ({ page }) => {
  // The cookie dialog is modal and makes the page inert for clicks.
  await page.addInitScript(() => {
    window.localStorage.setItem('cookieConsentGiven', 'true')
  })
})

test('board row → replay: two requests, a gzipped log, and no base64', async ({ page }) => {
  await stubDictionary(page)
  await stubLeaderboards(page)
  const replay = await stubReplay(page)

  await page.goto('/boards')
  await expect(page.getByTestId('boards-row').first()).toBeVisible()

  // Recording starts AFTER the board has loaded, so everything captured below
  // belongs to opening the replay and nothing else.
  const replayRequests: string[] = []
  const logResponses: Response[] = []
  const bodies = new Map<string, string>()
  const bodyReads: Promise<unknown>[] = []

  page.on('request', (request) => {
    if (REPLAY_URL.test(request.url())) replayRequests.push(new URL(request.url()).pathname)
  })
  page.on('response', (response) => {
    if (!REPLAY_URL.test(response.url())) return
    const path = new URL(response.url()).pathname
    if (path.endsWith('/replay/log')) logResponses.push(response)
    bodyReads.push(
      response.text().then(
        (text) => bodies.set(path, text),
        () => undefined
      )
    )
  })

  await page.getByTestId('boards-watch').first().click()
  await page.waitForURL((url) => url.pathname === `/replay/${DEFAULT_RUN_ID}`)

  // The player mounted: the run's own header is on screen…
  await expect(page.getByTestId('replay-grade')).toHaveText('S')
  await expect(page.getByTestId('replay-score')).toHaveText('12480')
  // …the ghost field rendered the words regenerated from the seed…
  await page.waitForFunction(
    () =>
      (document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word').length ?? 0) > 0
  )
  // …and it is PLAYING: the virtual clock advanced the progress fill off zero
  // with nobody touching the controls.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const fill = document.querySelector<HTMLElement>('[data-slot="progress-fill-indicator"]')
          return Number(fill?.style.getPropertyValue('--progress-scale') ?? '0')
        }),
      { timeout: 15_000 }
    )
    .toBeGreaterThan(0)

  // (a) TWO requests, in the documented order — metadata, then the log. Not one
  // combined call, and not a log fetch racing ahead of "does this run exist".
  expect(replayRequests).toEqual([
    `/api/v1/runs/${DEFAULT_RUN_ID}/replay`,
    `/api/v1/runs/${DEFAULT_RUN_ID}/replay/log`
  ])

  // (b) The log really came over the wire compressed.
  expect(logResponses).toHaveLength(1)
  const logHeaders = await logResponses[0].allHeaders()
  expect(logHeaders['content-encoding']).toBe('gzip')
  expect(logHeaders['cache-control']).toBe('public, max-age=31536000, immutable')
  // Compressed bytes on the wire, decompressed JSON in the page: the two sizes
  // differ, so `content-encoding` is not a label stuck on an uncompressed body.
  expect(Number(logHeaders['content-length'])).toBe(replay.logBytes.gzip)
  expect(replay.logBytes.gzip).toBeLessThan(replay.logBytes.json)

  await Promise.all(bodyReads)

  // (c) NO base64. The metadata has no `log` field at all…
  const metaBody: Record<string, unknown> = JSON.parse(
    bodies.get(`/api/v1/runs/${DEFAULT_RUN_ID}/replay`) ?? '{}'
  )
  expect(Object.keys(metaBody)).not.toContain('log')
  expect(metaBody.seed).toEqual(expect.any(Number))
  expect(metaBody.dictHash).toBe(replay.dictHash)

  // …the log arrived as ordinary JSON the HTTP stack had already decompressed…
  const logText = bodies.get(`/api/v1/runs/${DEFAULT_RUN_ID}/replay/log`) ?? ''
  const logBody: { version: number; events: unknown[] } = JSON.parse(logText)
  expect(logBody.version).toBe(1)
  expect(logBody.events.length).toBeGreaterThan(0)

  // …and no body the page consumed is a base64 blob, at the top level or nested.
  expect(bodies.size).toBe(2)
  for (const [path, text] of bodies) {
    expect(text.trim(), `${path} is a base64 blob`).not.toMatch(BASE64_BLOB)
  }
  expect(carriesBase64Payload(metaBody)).toBe(false)
  expect(carriesBase64Payload(logBody)).toBe(false)
})

test('a failed log keeps the run on screen and recovers on retry', async ({ page }) => {
  await stubDictionary(page)
  const replay = await stubReplay(page, { logStatus: 500 })

  await page.goto(`/replay/${DEFAULT_RUN_ID}`)

  // A 5xx is retried twice with backoff before the query gives up.
  const panel = page.getByTestId('replay-log-error')
  await expect(panel).toBeVisible({ timeout: 20_000 })
  // The run exists — this is not "no such run", and it must not read like it.
  await expect(page.getByTestId('replay-not-found')).toHaveCount(0)
  await expect(panel).toContainText(`by ${replay.displayName}`)
  await expect(panel).toContainText('could not load this run’s keystrokes')

  replay.recoverLog()
  await page.getByTestId('replay-log-retry').click()

  await expect(page.getByTestId('replay-grade')).toBeVisible({ timeout: 15_000 })
  await expect(panel).toHaveCount(0)
})

test('a 404 on the metadata is final: not-found, a way back, no retry', async ({ page }) => {
  await stubDictionary(page)
  await stubReplay(page, { metaStatus: 404 })

  const logRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/replay/log')) logRequests.push(request.url())
  })

  await page.goto('/replay/run-that-never-was')

  const panel = page.getByTestId('replay-not-found')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('that run is not available')
  await expect(page.getByTestId('replay-back')).toBeVisible()
  await expect(page.getByTestId('replay-log-retry')).toHaveCount(0)
  // The log query is gated on the metadata SUCCEEDING: asking for the log of a
  // run the server just 404'd would spend a rate-limit token to learn nothing.
  expect(logRequests).toEqual([])
})

test('a word list that no longer hashes to its address is a mismatch, not a 404', async ({
  page
}) => {
  const STALE_HASH = 'a1b2c3d4'
  // The body is served AT `STALE_HASH` but hashes to something else — a
  // republished word list, which is the only thing this panel is for.
  await stubDictionary(page, { alsoServeAt: STALE_HASH })
  await stubReplay(page, { dictHash: STALE_HASH })

  await page.goto(`/replay/${DEFAULT_RUN_ID}`)

  const panel = page.getByTestId('replay-dict-mismatch')
  await expect(panel).toBeVisible({ timeout: 15_000 })
  await expect(panel).toContainText('this run’s word list no longer matches the published one')
  await expect(page.getByTestId('replay-dict-error')).toHaveCount(0)
  await expect(page.getByTestId('replay-grade')).toHaveCount(0)
})

test('leaving the replay returns to the board it was opened from', async ({ page }) => {
  await stubDictionary(page)
  await stubLeaderboards(page)
  await stubReplay(page)

  await page.goto('/boards')
  await page.getByTestId('boards-watch').first().click()

  await page.waitForURL((url) => url.pathname === `/replay/${DEFAULT_RUN_ID}`)
  // The row hands the bucket along so the replay can offer the way back.
  expect(new URL(page.url()).searchParams.get('bucket')).toBe(WORDS_10_DE)
  await expect(page.getByTestId('replay-grade')).toBeVisible({ timeout: 15_000 })

  await page.locator('[button-label="Exit replay"]').click()

  await page.waitForURL(/\/boards/)
  expect(new URL(page.url()).searchParams.get('bucket')).toBe(WORDS_10_DE)
  await expect(page.getByTestId('boards-row')).toHaveCount(2)
})
