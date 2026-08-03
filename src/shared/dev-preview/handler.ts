/**
 * DEV-ONLY request handler for the profile preview.
 *
 * `request()` (shared/api/transport.ts) calls this before it touches the
 * network, under `import.meta.env.DEV`. Answering here — rather than seeding
 * the query cache from the pages — means the pages, their gates, their loading
 * chrome, their retries and their error states all run exactly as they do
 * against the real server; the only thing replaced is what comes back over the
 * wire.
 *
 * Refusals are thrown as real `ApiError`s with the server's own codes, because
 * the two pages are largely a rendering of those: 403 `profile_closed`,
 * 403 `portrait_closed`, 404, 401.
 *
 * Anything this file does not recognise returns `null` — the request goes to
 * the network as usual, so preview mode never blinds the rest of the app.
 */

import { ApiError } from '../api/transport'
import * as fixtures from './fixtures'
import {
  PREVIEW_LONG_NAME,
  PREVIEW_ME,
  previewDelayMs,
  previewScenario,
  type PreviewScenario
} from './scenario'

/** A mocked body. Wrapped so "no body" and "not handled" stay distinguishable. */
interface PreviewBody {
  readonly body: unknown
}

/** What the transport gets: the body, plus how long to hold it. */
export interface PreviewResponse extends PreviewBody {
  /** From `?previewDelay=` — 0 unless a preview is deliberately slowed down. */
  readonly delayMs: number
}

interface PreviewRequest {
  /** `{ cursor, days, from, to }` — ofetch's query object, as endpoints pass it. */
  readonly query?: Record<string, unknown>
  readonly method?: string
}

const str = (value: unknown): string | undefined =>
  value === undefined || value === null || value === '' ? undefined : String(value)

const num = (value: unknown): number | undefined => {
  const parsed = Number(value)
  return value === undefined || value === null || Number.isNaN(parsed) ? undefined : parsed
}

const fail = (status: number, code: string): never => {
  throw new ApiError({ status, code, message: `dev preview: ${code}` })
}

/**
 * The name a `/users/{name}[/section]` path is about, decoded. `/users` alone
 * is the SEARCH route, not a profile, and is left to the network.
 */
const userPath = (path: string): { name: string; section: string } | null => {
  const segments = path.split('/').filter((segment) => segment !== '')
  if (segments[0] !== 'users' || segments.length < 2 || segments.length > 3) return null
  return { name: decodeURIComponent(segments[1]!), section: segments[2] ?? '' }
}

const isMe = (name: string): boolean => name.toLowerCase() === PREVIEW_ME.toLowerCase()

/** Own-profile sections. `name` is the session's, so the card is titled. */
const ownSection = (
  path: string,
  req: PreviewRequest,
  scenario: PreviewScenario
): PreviewBody | null => {
  const empty = scenario === 'empty'
  const stress = scenario === 'stress'
  const name = stress ? PREVIEW_LONG_NAME : PREVIEW_ME

  switch (path) {
    case '/profile/summary':
      return { body: fixtures.summary(name, empty, stress) }
    case '/profile/activity':
      return { body: fixtures.activity(name, num(req.query?.days) ?? 365, empty) }
    case '/profile/histogram':
      return { body: fixtures.histogram(name, empty) }
    case '/profile/timeseries':
      return {
        body: fixtures.timeseries(name, str(req.query?.from), str(req.query?.to), empty)
      }
    case '/profile/pbs':
      return { body: fixtures.pbs(name, empty) }
    case '/profile/keyboard':
      return { body: fixtures.keyboard(name, empty) }
    case '/runs':
      return { body: fixtures.runs(name, str(req.query?.cursor), empty) }
    default:
      return null
  }
}

/** Public sections, plus the server's privacy answers. */
const publicSection = (
  target: { name: string; section: string },
  req: PreviewRequest,
  scenario: PreviewScenario
): PreviewBody | null => {
  const { name, section } = target
  const empty = scenario === 'empty'
  const stress = scenario === 'stress'

  // An unknown name is a 404 on the header AND on every section under it.
  if (scenario === 'missing') return fail(404, 'not_found')

  // A closed profile still answers the header — that is the whole contract —
  // and refuses the data, unless the viewer is its owner. The server decides
  // that; here, "the viewer" is the mocked session (PREVIEW_ME).
  const closed = scenario === 'closed' && !isMe(name)

  if (section === '') return { body: fixtures.publicProfile(name, !closed) }
  if (closed) return fail(403, 'profile_closed')
  if (scenario === 'error') return fail(500, 'internal')

  switch (section) {
    case 'summary':
      return { body: fixtures.summary(name, empty, stress) }
    case 'activity':
      return { body: fixtures.activity(name, num(req.query?.days) ?? 365, empty) }
    case 'histogram':
      return { body: fixtures.histogram(name, empty) }
    case 'timeseries':
      return {
        body: fixtures.timeseries(name, str(req.query?.from), str(req.query?.to), empty)
      }
    case 'pbs':
      return { body: fixtures.pbs(name, empty) }
    case 'portrait':
      // The portrait is a second, narrower switch: an open profile may still
      // keep its keyboard private, and the page renders that as a state.
      return scenario === 'portrait'
        ? fail(403, 'portrait_closed')
        : { body: fixtures.keyboard(name, empty) }
    case 'runs':
      return { body: fixtures.publicRuns(name, str(req.query?.cursor), empty) }
    default:
      return null
  }
}

/**
 * Answers `url` from fixtures, or returns `null` to let the request through.
 * Throws {@link ApiError} for the states that ARE refusals.
 */
const resolve = (url: string, req: PreviewRequest): PreviewBody | null => {
  const scenario = previewScenario()
  if (scenario === null) return null

  // Reads only: a preview never pretends to have accepted a write.
  const method = (req.method ?? 'GET').toUpperCase()
  if (method !== 'GET') return null

  const path = url.split('?')[0] ?? url

  if (path === '/me') {
    return scenario === 'guest'
      ? fail(401, 'unauthorized')
      : { body: fixtures.me(scenario === 'stress' ? PREVIEW_LONG_NAME : PREVIEW_ME) }
  }

  // A quote row's text, so the runs table's quote cell resolves too. `/random`
  // belongs to the game, not to a profile, and is left alone.
  if (path.startsWith('/quotes/') && path !== '/quotes/random') {
    return { body: fixtures.quote(decodeURIComponent(path.slice('/quotes/'.length))) }
  }

  const target = userPath(path)
  if (target !== null) return publicSection(target, req, scenario)

  const own = ownSection(path, req, scenario)
  if (own === null) return null

  // The own page's states: no session at all, or every aggregate failing.
  if (scenario === 'guest') return fail(401, 'unauthorized')
  if (scenario === 'error') return fail(500, 'internal')
  return own
}

/**
 * Answers `url` from fixtures, or returns `null` to let the request through.
 * Throws {@link ApiError} for the states that ARE refusals.
 */
export const devPreviewResponse = (
  url: string,
  req: PreviewRequest = {}
): PreviewResponse | null => {
  const body = resolve(url, req)
  return body === null ? null : { ...body, delayMs: previewDelayMs() }
}
