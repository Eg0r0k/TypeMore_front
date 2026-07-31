import { expect, test } from '@playwright/test'
import {
  DEFAULT_RUN_ID,
  stubDictionary,
  stubLeaderboards,
  stubReplay
} from './fixtures/leaderboards'
import { stubPublicProfile } from './fixtures/users'

/**
 * Public profiles and the privacy boundary (backend docs/PROFILE.md):
 *
 *   board → click a nick → /u/{name}. A CLOSED profile renders nick + the
 *   explicit closed state and not one data section — while that same player's
 *   BOARD run still replays, because closing a profile hides the aggregated
 *   history page, never a result its owner put into a public ranking.
 */

test.beforeEach(async ({ page }) => {
  // The cookie dialog is modal and makes the page inert for clicks.
  await page.addInitScript(() => {
    window.localStorage.setItem('cookieConsentGiven', 'true')
  })
})

test('closed profile: board nick → closed page with no data, board replay still opens', async ({
  page
}) => {
  await stubDictionary(page)
  await stubLeaderboards(page)
  await stubReplay(page)
  // 'Ada' holds rank 1 of the busiest board (run-ada) and keeps her profile
  // CLOSED.
  const profile = await stubPublicProfile(page, { name: 'Ada', public: false })

  await page.goto('/boards')
  await expect(page.getByTestId('boards-row').first()).toBeVisible()

  // The nick is a link; clicking it goes to the profile page, not the replay.
  await page.getByTestId('boards-profile-link').first().click()
  await page.waitForURL((url) => url.pathname === '/u/Ada')

  // The closed state: nick + the explicit "closed" line…
  await expect(page.getByTestId('user-closed')).toBeVisible()
  await expect(page.getByTestId('user-closed-nick')).toHaveText('Ada')
  // …and NOT ONE data section in the DOM.
  await expect(page.locator('[data-testid^="profile-section-"]')).toHaveCount(0)
  await expect(page.getByTestId('profile-runs')).toHaveCount(0)
  // The page did not even ask for data — the server would refuse anyway; a
  // client that asks and hides would be indistinguishable here, so the
  // fixture records what was requested.
  expect(profile.dataRequests).toHaveLength(0)

  // THE BOUNDARY PIN: her run on the board still resolves and replays. The
  // wire is the proof (the run is short and can finish playing before an
  // in-player assertion lands, so UI-wise we accept either the playing or the
  // finished state — and refuse every error state).
  const replayStatuses: number[] = []
  page.on('response', (response) => {
    if (/\/api\/v1\/runs\/[^/?]+\/replay(\/log)?(\?|$)/.test(response.url())) {
      replayStatuses.push(response.status())
    }
  })
  await page.goto('/boards')
  await expect(page.getByTestId('boards-row').first()).toBeVisible()
  await page.getByTestId('boards-watch').first().click()
  await page.waitForURL((url) => url.pathname === `/replay/${DEFAULT_RUN_ID}`)

  // Playing or already finished — never "not available", never a log error.
  await expect(page.getByTestId('replay-grade').or(page.getByTestId('replay-results'))).toBeVisible()
  await expect(page.getByTestId('replay-not-found')).toHaveCount(0)
  await expect(page.getByTestId('replay-log-error')).toHaveCount(0)
  // Both halves of the replay came back 200 for a CLOSED profile's board run.
  expect(replayStatuses.length).toBeGreaterThanOrEqual(2)
  expect(replayStatuses.every((status) => status === 200)).toBe(true)
})

test('open profile: board nick → the read-only profile page with its sections', async ({
  page
}) => {
  await stubDictionary(page)
  await stubLeaderboards(page)
  await stubReplay(page)
  await stubPublicProfile(page, { name: 'Ada', public: true })

  await page.goto('/boards')
  await expect(page.getByTestId('boards-row').first()).toBeVisible()
  await page.getByTestId('boards-profile-link').first().click()
  await page.waitForURL((url) => url.pathname === '/u/Ada')

  // The identity header and the stat sections rendered from the public data…
  await expect(page.getByTestId('profile-nick')).toHaveText('Ada')
  await expect(page.getByTestId('profile-section-stats')).toBeVisible()
  // …the portrait section renders the server's refusal as its own state
  // (keyboard_public is off by default — the biometric opt-in)…
  await expect(page.getByTestId('user-portrait-closed')).toBeVisible()
  // …and the page is read-only: not one race action anywhere.
  await expect(page.getByTestId('profile-run-race')).toHaveCount(0)
  await expect(page.locator('[data-testid^="profile-pb-race-"]')).toHaveCount(0)
})
