/**
 * The date column's two halves: the relative label the cell shows, and the
 * exact instant its tooltip carries. Both come out of dayjs (the shared
 * datetime boundary) — the tests pin the UNIT boundaries, the fallbacks, and
 * the regression that motivated the switch: Russian relatives must spell the
 * direction out («назад»), never a signed number («-3 дн.»).
 */
import { describe, expect, it } from 'vitest'

import {
  formatExactAchievedAt,
  formatRelativeAchievedAt
} from '@/features/leaderboards/model/format'

const NOW = Date.parse('2026-07-28T12:00:00.000Z')
const at = (iso: string): string => formatRelativeAchievedAt(iso, 'en', NOW)

describe('formatRelativeAchievedAt', () => {
  it('speaks minutes under an hour, hours under a day, days under ~a month', () => {
    // The exact spelling ("5m ago" vs "5 min. ago") is the ICU build's; the
    // UNIT is ours.
    expect(at('2026-07-28T11:55:00.000Z')).toMatch(/5\s?m/)
    expect(at('2026-07-28T09:00:00.000Z')).toMatch(/3\s?h/)
    expect(at('2026-07-25T12:00:00.000Z')).toMatch(/3\s?d/)
  })

  it('spells the direction out, in Russian too — the «-3 дн.» regression', () => {
    expect(at('2026-07-27T12:00:00.000Z')).toBe('a day ago')
    const ru = formatRelativeAchievedAt('2026-07-25T12:00:00.000Z', 'ru', NOW)
    expect(ru).toContain('назад')
    expect(ru).not.toContain('-3')
  })

  it('falls back to the calendar date beyond four weeks — "37 days ago" reads worse', () => {
    const old = at('2026-05-01T12:00:00.000Z')
    expect(old).not.toContain('ago')
    expect(old).toMatch(/26|2026/)
  })

  it('shows the date, not a future-relative guess, for a clock-skewed timestamp', () => {
    const skewed = at('2026-07-28T12:05:00.000Z')
    expect(skewed).not.toContain('in ')
  })

  it('renders a dash for garbage instead of NaN soup', () => {
    expect(at('not-a-date')).toBe('—')
    expect(formatExactAchievedAt('not-a-date', 'en')).toBe('—')
  })
})

describe('formatExactAchievedAt', () => {
  it('carries the full instant — date AND time — for the tooltip', () => {
    const exact = formatExactAchievedAt('2026-07-25T13:43:14.772Z', 'en')
    expect(exact).toMatch(/2026/)
    expect(exact).toMatch(/\d{1,2}:\d{2}/)
  })
})
