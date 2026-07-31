import type { Page } from '@playwright/test'

/**
 * Public profile stubs (`GET /api/v1/users/{name}/…`) for the backend-less E2E
 * harness. Bodies mirror `TypeMore_back/docs/PROFILE.md`, "Public profiles",
 * field for field — including the SERVER-side privacy contract: a closed
 * profile answers `200 {public:false}` on the header and `403 profile_closed`
 * on every data route, so a spec can prove the page renders the refusal rather
 * than filtering client-side.
 */

export interface PublicProfileStubOptions {
  readonly name?: string
  /** Closed by the owner: header still 200, every data route 403. */
  readonly public?: boolean
  /** The portrait's own switch (only consulted while the profile is open). */
  readonly keyboardPublic?: boolean
}

export interface PublicProfileStub {
  readonly name: string
  /** Data paths a spec can assert were (or were never) requested. */
  readonly dataRequests: readonly string[]
}

const SUMMARY = {
  displayName: '',
  joined: '2026-07-01T00:00:00.000Z',
  testsStarted: 7,
  testsCompleted: 5,
  restartsPerCompleted: 0.4,
  timeTypingMs: 93_000,
  estimatedWordsTyped: 310,
  wpm: { highest: 113.1, average: 108.4, averageLast10: 108.4 },
  raw: { highest: 118.2, average: 112.1, averageLast10: 112.1 },
  acc: { highest: 1, average: 0.967, averageLast10: 0.967 },
  consistency: { highest: 0.83, average: 0.79, averageLast10: 0.79 },
  streak: { current: 1, best: 4 },
  languages: [{ lang: 'german', tests: 5 }]
}

export async function stubPublicProfile(
  page: Page,
  options: PublicProfileStubOptions = {}
): Promise<PublicProfileStub> {
  const name = options.name ?? 'Ada'
  const isPublic = options.public ?? true
  const keyboardPublic = options.keyboardPublic ?? false
  const dataRequests: string[] = []

  const json = (status: number, body: unknown) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
  })

  // The pattern only picks the subtree; the pathname split below does the
  // actual routing (and keeps the regex linear for the lint's ReDoS check).
  await page.route(/\/api\/v1\/users\//, (route) => {
    const url = new URL(route.request().url())
    // '/api/v1/users/{name}/{section?}' → ['', 'api', 'v1', 'users', name, section?]
    const [, , , , requested, section] = url.pathname.split('/')
    // citext on the server: the lookup is case-insensitive.
    if (decodeURIComponent(requested ?? '').toLowerCase() !== name.toLowerCase()) {
      return route.fulfill(json(404, { error: 'not_found', message: 'no such profile' }))
    }

    if (section === undefined) {
      return route.fulfill(
        json(200, { name, joined: SUMMARY.joined, public: isPublic })
      )
    }

    dataRequests.push(url.pathname)
    if (!isPublic) {
      return route.fulfill(
        json(403, { error: 'profile_closed', message: 'this profile is private' })
      )
    }
    switch (section) {
      case 'summary':
        return route.fulfill(json(200, { ...SUMMARY, displayName: name }))
      case 'activity':
        return route.fulfill(json(200, { days: [{ date: '2026-07-28', tests: 5, timeMs: 93_000 }] }))
      case 'histogram':
        return route.fulfill(json(200, { buckets: [{ wpm: 100, tests: 5 }] }))
      case 'timeseries':
        return route.fulfill(
          json(200, {
            days: [{ date: '2026-07-28', timeTypingMs: 93_000, avgWpm: 108.4, avgAcc: 0.967 }],
            wpmPerHour: 3.2
          })
        )
      case 'pbs':
        return route.fulfill(json(200, { pbs: [] }))
      case 'portrait':
        return keyboardPublic
          ? route.fulfill(json(200, { layout: 'qwerty', keys: [] }))
          : route.fulfill(
              json(403, { error: 'portrait_closed', message: 'the keyboard portrait is private' })
            )
      case 'runs':
        return route.fulfill(json(200, { runs: [], nextCursor: undefined }))
      default:
        return route.fulfill(json(404, { error: 'not_found', message: 'no such route' }))
    }
  })

  return { name, dataRequests }
}
