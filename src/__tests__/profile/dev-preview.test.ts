import { afterEach, describe, expect, it } from 'vitest'
import * as v from 'valibot'

import { devPreviewResponse } from '@/shared/dev-preview/handler'
import * as fixtures from '@/shared/dev-preview/fixtures'
import {
  PREVIEW_ME,
  PREVIEW_SCENARIOS,
  previewScenario,
  setPreviewScenario
} from '@/shared/dev-preview'
import { isApiError } from '@shared/api'
import {
  ProfileActivitySchema,
  ProfileHistogramSchema,
  ProfileKeyboardSchema,
  ProfilePBsSchema,
  ProfileSummarySchema,
  ProfileTimeseriesSchema
} from '@/shared/api/profile/schemas'
import { PublicProfileSchema, PublicRunListSchema } from '@/shared/api/users/schemas'
import { RunListSchema } from '@/shared/api/runs/schemas'
import { QuoteSchema } from '@/shared/api/quotes/schemas'
import { UserSchema } from '@/shared/api/auth/schemas'

/**
 * The DEV profile preview (`shared/dev-preview`).
 *
 * Two things are worth pinning. First, that every fixture still PARSES with the
 * schema of the endpoint it stands in for: the preview enters at the transport
 * boundary, so a fixture that drifts from the contract would show a designer a
 * page the server can never produce. Second, that the refusal scenarios refuse
 * the way the server does — those refusals are most of what the two pages
 * render, and the preview exists mostly to look at them.
 */

const scenarioOn = (name: (typeof PREVIEW_SCENARIOS)[number]): void => setPreviewScenario(name)

afterEach(() => {
  setPreviewScenario(null)
})

/** Runs `call` and returns the ApiError it must have thrown. */
const refusal = (call: () => unknown): { status: number; code: string } => {
  try {
    call()
  } catch (error) {
    if (isApiError(error)) return { status: error.status, code: error.code }
    throw error
  }
  throw new Error('expected a refusal, got a body')
}

describe('dev preview fixtures', () => {
  it('parse with the schemas of the endpoints they stand in for', () => {
    const name = 'preview_rival'
    expect(() => v.parse(UserSchema, fixtures.me())).not.toThrow()
    expect(() => v.parse(ProfileSummarySchema, fixtures.summary(name, false))).not.toThrow()
    expect(() => v.parse(ProfileSummarySchema, fixtures.summary(name, true))).not.toThrow()
    expect(() => v.parse(ProfileActivitySchema, fixtures.activity(name, 365, false))).not.toThrow()
    expect(() => v.parse(ProfileHistogramSchema, fixtures.histogram(name, false))).not.toThrow()
    expect(() =>
      v.parse(ProfileTimeseriesSchema, fixtures.timeseries(name, undefined, undefined, false))
    ).not.toThrow()
    expect(() => v.parse(ProfilePBsSchema, fixtures.pbs(name, false))).not.toThrow()
    expect(() => v.parse(ProfileKeyboardSchema, fixtures.keyboard(name, false))).not.toThrow()
    expect(() => v.parse(PublicProfileSchema, fixtures.publicProfile(name, true))).not.toThrow()
    expect(() => v.parse(RunListSchema, fixtures.runs(name, undefined, false))).not.toThrow()
    expect(() =>
      v.parse(PublicRunListSchema, fixtures.publicRuns(name, undefined, false))
    ).not.toThrow()
    expect(() => v.parse(QuoteSchema, fixtures.quote('en-0100'))).not.toThrow()
  })

  it('are stable per name, so a reload redraws the same page', () => {
    const first = fixtures.histogram('preview_rival', false)
    const second = fixtures.histogram('preview_rival', false)
    expect(second).toEqual(first)
    expect(fixtures.histogram('someone_else', false)).not.toEqual(first)
  })

  it('honour the timeseries range the chart presets ask for', () => {
    const all = fixtures.timeseries('preview_rival', undefined, undefined, false)
    const from = all.days.at(-7)?.date
    const week = fixtures.timeseries('preview_rival', from, undefined, false)
    expect(week.days).toHaveLength(7)
    // A day keeps its numbers whichever range asked for it.
    expect(week.days.at(-1)).toEqual(all.days.at(-1))
  })

  it('give a fresh account honest zeroes', () => {
    const empty = fixtures.summary('newcomer', true)
    expect(empty.testsCompleted).toBe(0)
    expect(empty.wpm.average).toBe(0)
    expect(empty.languages).toEqual([])
    expect(fixtures.pbs('newcomer', true).pbs).toEqual([])
    expect(fixtures.runs('newcomer', undefined, true).runs).toEqual([])
  })
})

describe('dev preview handler', () => {
  it('is off by default — every request goes to the network', () => {
    expect(previewScenario()).toBeNull()
    expect(devPreviewResponse('/profile/summary')).toBeNull()
    expect(devPreviewResponse('/me')).toBeNull()
  })

  it('answers the own-profile sections when on', () => {
    scenarioOn('full')
    expect(devPreviewResponse('/profile/summary')?.body).toMatchObject({ displayName: PREVIEW_ME })
    expect(devPreviewResponse('/runs')?.body).toHaveProperty('nextCursor')
  })

  it('never answers a write, and never answers a route it does not know', () => {
    scenarioOn('full')
    expect(devPreviewResponse('/runs', { method: 'POST' })).toBeNull()
    expect(devPreviewResponse('/dictionaries')).toBeNull()
    // `/users` with no name is the SEARCH route, not a profile.
    expect(devPreviewResponse('/users', { query: { q: 'pre' } })).toBeNull()
  })

  it('refuses a closed profile per section, but still answers its header', () => {
    scenarioOn('closed')
    expect(devPreviewResponse('/users/preview_rival')?.body).toMatchObject({ public: false })
    expect(refusal(() => devPreviewResponse('/users/preview_rival/summary'))).toEqual({
      status: 403,
      code: 'profile_closed'
    })
  })

  it('lets the OWNER through their own closed profile, exactly as the server does', () => {
    scenarioOn('closed')
    expect(devPreviewResponse(`/users/${PREVIEW_ME}`)?.body).toMatchObject({ public: true })
    expect(devPreviewResponse(`/users/${PREVIEW_ME}/summary`)?.body).toBeTruthy()
  })

  it('closes the portrait alone on an otherwise open profile', () => {
    scenarioOn('portrait')
    expect(devPreviewResponse('/users/preview_rival/summary')?.body).toBeTruthy()
    expect(refusal(() => devPreviewResponse('/users/preview_rival/portrait'))).toEqual({
      status: 403,
      code: 'portrait_closed'
    })
  })

  it('404s an unknown name, header included', () => {
    scenarioOn('missing')
    expect(refusal(() => devPreviewResponse('/users/nobody')).status).toBe(404)
    expect(refusal(() => devPreviewResponse('/users/nobody/pbs')).status).toBe(404)
  })

  it('drops the session for the guest scenario, and only the session', () => {
    scenarioOn('guest')
    expect(refusal(() => devPreviewResponse('/me')).status).toBe(401)
    expect(refusal(() => devPreviewResponse('/profile/summary')).status).toBe(401)
    // A public page is readable without one.
    expect(devPreviewResponse('/users/preview_rival/summary')?.body).toBeTruthy()
  })

  it('fails every aggregate for the error scenario, keeping the header alive', () => {
    scenarioOn('error')
    expect(refusal(() => devPreviewResponse('/profile/summary')).status).toBe(500)
    expect(devPreviewResponse('/users/preview_rival')?.body).toMatchObject({ public: true })
    expect(refusal(() => devPreviewResponse('/users/preview_rival/pbs')).status).toBe(500)
  })

  it('decodes a name out of the path', () => {
    scenarioOn('full')
    expect(devPreviewResponse(`/users/${encodeURIComponent('Егор')}`)?.body).toMatchObject({
      name: 'Егор'
    })
  })
})
