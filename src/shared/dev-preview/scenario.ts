/**
 * DEV-ONLY profile preview — the flag, and nothing else.
 *
 * `/profile` and `/u/{name}` are the two pages whose look is decided almost
 * entirely by data a designer cannot conjure locally: a year of activity, a
 * board of personal bests, a keyboard portrait, and the server's REFUSALS
 * (a closed profile, a private portrait, an unknown name). Preview mode feeds
 * those pages fixtures at the transport boundary, so every state can be looked
 * at without a backend, an account, or a year of typing.
 *
 * Turning it on is a URL: `/profile?preview=1`, `/u/anyone?preview=closed`.
 * The choice is remembered in `sessionStorage` for the tab (so navigating away
 * from the URL that set it keeps the preview), and `?preview=off` clears it.
 *
 * Everything here is behind `import.meta.env.DEV`: in a production build the
 * flag reads `null` forever, and the fixtures and the badge are never even
 * imported (their only import sites are DEV-guarded dynamic ones).
 */

/**
 * The states worth looking at. Each one is a page state the two pages
 * document, not a data variation for its own sake:
 *
 * - `full`     — a lived-in account: every section populated.
 * - `empty`    — a fresh account: honest zeroes and empty states.
 * - `stress`   — the layout's worst case: a name at the length limit, twelve
 *                languages with five-digit counts, a very long streak.
 * - `closed`   — `/u` of a player who closed their profile (403 per section).
 * - `portrait` — an open profile that keeps its keyboard portrait private.
 * - `missing`  — `/u` of a name nobody has (the 404 state).
 * - `error`    — every aggregate fails: the grey card + retry chrome.
 * - `guest`    — no session: `/profile` renders its sign-in hint.
 */
export const PREVIEW_SCENARIOS = [
  'full',
  'empty',
  'stress',
  'closed',
  'portrait',
  'missing',
  'error',
  'guest'
] as const

export type PreviewScenario = (typeof PREVIEW_SCENARIOS)[number]

/**
 * The display name the mocked `/me` answers with. It matters on `/u`: the page
 * asks the server who the viewer is and lets an OWNER through their own closed
 * profile, so `/u/preview_you?preview=closed` previews the owner's view of a
 * closed page while `/u/anyone_else?preview=closed` previews a stranger's.
 */
export const PREVIEW_ME = 'preview_you'

/** A second name to look at, so the badge can offer "somebody else's page". */
export const PREVIEW_OTHER = 'preview_rival'

/**
 * 24 characters with no spaces — the display name's upper bound and the header's
 * worst case. The `stress` scenario answers with it.
 */
export const PREVIEW_LONG_NAME = 'preview_long_name_abcdef'

const STORAGE_KEY = 'typemore:dev-preview'
const URL_PARAM = 'preview'

/** `?preview=1` and friends mean "on, default scenario". */
const TRUTHY = new Set(['', '1', 'on', 'true', 'yes'])
/** `?preview=off` and friends mean "clear the flag". */
const FALSY = new Set(['0', 'off', 'false', 'no', 'none'])

const isScenario = (value: string): value is PreviewScenario =>
  (PREVIEW_SCENARIOS as readonly string[]).includes(value)

/** sessionStorage is unavailable in some embeddings; a preview is never worth throwing over. */
const readStore = (): string | null => {
  try {
    return globalThis.sessionStorage?.getItem(STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

const writeStore = (value: PreviewScenario | null): void => {
  try {
    if (value === null) globalThis.sessionStorage?.removeItem(STORAGE_KEY)
    else globalThis.sessionStorage?.setItem(STORAGE_KEY, value)
  } catch {
    /* no storage, no memory — the URL still works for this page load */
  }
}

/** The scenario named in the CURRENT url, `'off'` for an explicit clear. */
const fromUrl = (): PreviewScenario | 'off' | null => {
  const search = globalThis.location?.search
  if (search === undefined || search === '') return null
  const raw = new URLSearchParams(search).get(URL_PARAM)
  if (raw === null) return null
  const value = raw.trim().toLowerCase()
  if (FALSY.has(value)) return 'off'
  if (TRUTHY.has(value)) return 'full'
  return isScenario(value) ? value : 'full'
}

/**
 * The active scenario, or `null` when preview mode is off — which is always,
 * in a production build.
 *
 * Read at every request rather than cached at module load: the URL is the
 * primary switch, and it changes under a client-side router without reloading
 * this module.
 */
export const previewScenario = (): PreviewScenario | null => {
  if (!import.meta.env.DEV) return null

  const url = fromUrl()
  if (url === 'off') {
    writeStore(null)
    return null
  }
  if (url !== null) {
    // The URL wins and is remembered, so leaving it keeps the preview on.
    if (readStore() !== url) writeStore(url)
    return url
  }

  const stored = readStore()
  return stored !== null && isScenario(stored) ? stored : null
}

/**
 * Milliseconds to hold every previewed response for, from `?previewDelay=600`.
 *
 * The point is the LOADING states: fixtures answer within a microtask, so a
 * skeleton would otherwise exist for a frame nobody can look at (or screenshot).
 * URL-only and never remembered — a preview that stayed slow after the URL
 * changed would be a bug hunt waiting to happen.
 */
export const previewDelayMs = (): number => {
  if (!import.meta.env.DEV) return 0
  const search = globalThis.location?.search
  if (search === undefined || search === '') return 0
  const raw = new URLSearchParams(search).get('previewDelay')
  const parsed = Number(raw)
  return raw !== null && Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 60_000) : 0
}

/**
 * Switches the scenario for the tab. Does NOT reload — the caller decides,
 * and the badge reloads on purpose: `/me` resolves once per page load, so a
 * scenario that changes the session (`guest`) only reads true after one.
 */
export const setPreviewScenario = (next: PreviewScenario | null): void => {
  if (!import.meta.env.DEV) return
  writeStore(next)
}
