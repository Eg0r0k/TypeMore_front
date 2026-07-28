import { expect, test } from '@playwright/test'
import { stubDictionary, stubLeaderboards, stubReplay } from './fixtures/leaderboards'

/**
 * `/race/:runId` — racing a board run's ghost. The same public replay pair the
 * replay page consumes (metadata + REAL gzipped log + the dictionary by hash)
 * builds the ghost; the local seat is the live game core. This drives the
 * whole wire: board row → race action → countdown → the ghost actually types.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('cookieConsentGiven', 'true')
  })
  await stubDictionary(page)
  await stubLeaderboards(page)
  await stubReplay(page)
})

test('the race action seats you against the run’s ghost', async ({ page }) => {
  await page.goto('/boards')
  const first = page.getByTestId('boards-row').first()
  await expect(first).toContainText('Ada')

  // The actions float over the row on hover.
  await first.hover()
  await first.getByTestId('boards-action-race').click()

  await expect(page).toHaveURL(/\/race\/run-ada/)
  await expect(page.getByTestId('race-title')).toContainText('Ada')

  // Countdown first: nobody's clock starts before GO.
  await expect(page.getByTestId('race-countdown')).toBeVisible()
  await expect(page.getByTestId('race-countdown')).toBeHidden({ timeout: 6_000 })

  // After GO the ghost replays its stored log: its live wpm leaves zero, and
  // the fixture's short clean run finishes, which ends the race. The player
  // typed nothing, so the verdict is honest about who won.
  await expect(page.getByTestId('race-ghost-wpm')).not.toHaveText('0 wpm', { timeout: 6_000 })
  await expect(page.getByTestId('race-verdict')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('race-verdict')).toContainText('the ghost won')

  // The way back leads to the board the row came from.
  await page.getByTestId('race-back').click()
  await expect(page).toHaveURL(/\/boards\?bucket=/)
})
