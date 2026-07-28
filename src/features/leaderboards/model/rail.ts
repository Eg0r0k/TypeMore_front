import { isQuoteBucket, type BucketInfo, type LanguageBucket } from '@shared/api'

/**
 * The left rail's data, derived from the bucket catalogue.
 *
 * Everything here is built from REAL boards: the catalogue is the only source
 * of bucket keys (the key format has exactly one producer, and it is on the
 * server — LEADERBOARDS.md), so the rail can never offer a board the server
 * does not serve. What it CAN show is absence: a preset another language has
 * and this one does not is listed muted with its zero count, because "nobody
 * has played this here yet" is information and a missing chip is not.
 */

/** One row of the rail's LANGUAGE group. */
export interface RailLanguage {
  /** The dictionary KEY — what bucket keys and quote filters are written in. */
  readonly key: string
  /** The display name the dictionary catalogue publishes for the key. */
  readonly name: string
  /** Visible entries across this language's boards. 0 = no board yet. */
  readonly entries: number
}

/** One mode+dimension chip of the rail's VARIATIONS group. */
export interface RailVariation {
  /** Stable preset id: `time:15000`, `words:25`, … */
  readonly id: string
  readonly mode: 'time' | 'words'
  /** Milliseconds for `time`, words for `words` — the name its mode gives it. */
  readonly dimension: number
  /** The catalogue bucket key for the selected language, when one exists. */
  readonly bucket?: string
  /** Visible entries on that bucket. 0 ⇔ `bucket` is absent (muted chip). */
  readonly entries: number
}

const languageBuckets = (buckets: readonly BucketInfo[]): LanguageBucket[] =>
  buckets.filter((bucket): bucket is LanguageBucket => !isQuoteBucket(bucket))

const dimensionOf = (bucket: LanguageBucket): number =>
  bucket.mode === 'time' ? (bucket.durationMs ?? 0) : (bucket.wordCount ?? 0)

const presetId = (mode: string, dimension: number): string => `${mode}:${dimension}`

/**
 * The LANGUAGE group: every language the dictionary catalogue names, annotated
 * with how many board entries it holds.
 *
 * The dictionary catalogue is the base of the union because it is the only
 * place a key is NAMED (no client-side prettifying of `code_css`); a language
 * that appears in a bucket but not in the catalogue — a retired dictionary
 * whose board outlived it — is kept, under its key, exactly like the old
 * picker rendered it. Sorted by display name so search and scanning agree.
 */
export const railLanguages = (
  buckets: readonly BucketInfo[],
  catalogue: readonly { readonly lang: string; readonly name: string }[] | undefined
): RailLanguage[] => {
  const totals = new Map<string, number>()
  for (const bucket of languageBuckets(buckets)) {
    totals.set(bucket.lang, (totals.get(bucket.lang) ?? 0) + bucket.entries)
  }

  const named = new Map<string, string>()
  for (const row of catalogue ?? []) named.set(row.lang, row.name)
  for (const key of totals.keys()) {
    if (!named.has(key)) named.set(key, key)
  }

  return [...named]
    .map(([key, name]) => ({ key, name, entries: totals.get(key) ?? 0 }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.key < b.key ? -1 : 1))
}

/**
 * The VARIATIONS group for a language: one chip per preset that exists in the
 * catalogue — for ANY language, so the chip list is the set of ranked shapes
 * that are actually played, never an invented one. A preset the selected
 * language has no bucket for is listed with a zero count and no key: there is
 * nothing to navigate to (the client cannot mint a language bucket key), so
 * the chip is evidence, not an affordance.
 *
 * `time` presets first by duration, then `words` by count — the order the
 * game's own settings bar uses.
 */
export const railVariations = (
  buckets: readonly BucketInfo[],
  lang: string | undefined
): RailVariation[] => {
  const all = languageBuckets(buckets)

  const presets = new Map<string, { mode: 'time' | 'words'; dimension: number }>()
  for (const bucket of all) {
    const dimension = dimensionOf(bucket)
    presets.set(presetId(bucket.mode, dimension), { mode: bucket.mode, dimension })
  }

  const own = new Map<string, LanguageBucket>()
  for (const bucket of all) {
    if (bucket.lang === lang) own.set(presetId(bucket.mode, dimensionOf(bucket)), bucket)
  }

  return [...presets]
    .map(([id, preset]) => {
      const mine = own.get(id)
      return {
        id,
        mode: preset.mode,
        dimension: preset.dimension,
        ...(mine === undefined ? {} : { bucket: mine.bucket }),
        entries: mine?.entries ?? 0
      }
    })
    .sort((a, b) => (a.mode === b.mode ? a.dimension - b.dimension : a.mode === 'time' ? -1 : 1))
}

/**
 * Which bucket a language switch lands on: the same preset the visitor was
 * looking at when the new language has it (comparing 60s english to 60s german
 * is the whole point of switching), otherwise the language's most populated
 * board, otherwise nothing — the page renders the muted chips and says so.
 */
export const bucketForLanguage = (
  buckets: readonly BucketInfo[],
  lang: string,
  currentBucket: string | undefined
): string | undefined => {
  const own = languageBuckets(buckets).filter((bucket) => bucket.lang === lang)
  if (own.length === 0) return undefined

  const current = languageBuckets(buckets).find((bucket) => bucket.bucket === currentBucket)
  if (current !== undefined) {
    const samePreset = own.find(
      (bucket) => bucket.mode === current.mode && dimensionOf(bucket) === dimensionOf(current)
    )
    if (samePreset !== undefined) return samePreset.bucket
  }

  let best = own[0]
  for (const candidate of own) {
    if (
      candidate.entries > best.entries ||
      (candidate.entries === best.entries && candidate.bucket < best.bucket)
    ) {
      best = candidate
    }
  }
  return best.bucket
}
