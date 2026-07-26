/**
 * The dictionary catalogue is the SINGLE source of language naming.
 *
 * A language has two halves that must never be confused: `lang` is the
 * canonical key (`code_css`, `russian_empire`) that travels in configs, run
 * submissions, match settings and leaderboard bucket keys, and `name` is the
 * human name the server publishes for it. The bug these specs pin down is the
 * key leaking into the UI — the picker literally offered "css_code" as
 * something to read. No client-side prettifying can fix that (`code_css` does
 * not mangle into "CSS (code)"), so the rule is: render `name`, select `lang`,
 * and fall back to the key ONLY while the catalogue has not loaded.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import * as v from 'valibot'

import { i18n } from '@app/i18n'
import {
  DictionaryCatalogueSchema,
  DictionarySchema,
  dictionaryKeys,
  type BucketInfo,
  type DictionaryCatalogue
} from '@shared/api'
import { LanguageModal } from '@/features/modal/language'
import { BoardBucketPicker } from '@/features/leaderboards'

/**
 * Three rows chosen to be adversarial: a key that is already a word
 * (`english`), a key whose name shares no substring with it (`russian_empire`
 * → "Russian (pre-reform)"), and the renamed code dictionary at its real
 * content-addressed hash.
 */
const CATALOGUE: DictionaryCatalogue = [
  { lang: 'english', name: 'English', dictHash: 'be99aa1a', wordCount: 200, bytes: 1400 },
  {
    lang: 'russian_empire',
    name: 'Russian (pre-reform)',
    dictHash: 'aa11bb22',
    wordCount: 180,
    bytes: 2100
  },
  { lang: 'code_css', name: 'CSS (code)', dictHash: '55ccd317', wordCount: 72, bytes: 1234 }
]

let queryClient: QueryClient

/**
 * The catalogue is seeded, not fetched: every query in this file is
 * `staleTime: Infinity`, so pre-loaded data means no request is made and no
 * transport has to be stubbed.
 */
const seedCatalogue = (catalogue: DictionaryCatalogue | null): void => {
  if (catalogue !== null) queryClient.setQueryData(dictionaryKeys.catalogue(), catalogue)
}

beforeEach(() => {
  // Nothing here talks to a server: every case either seeds the catalogue or
  // deliberately runs without one, so fetching is switched off outright rather
  // than left to fail asynchronously after the test has finished.
  queryClient = new QueryClient({
    defaultOptions: { queries: { enabled: false, retry: false } }
  })
})

const mounted: { unmount: () => void }[] = []

// Both pickers portal into <body>; without an explicit unmount the previous
// test's nodes are still there and every `document` query sees two of them.
afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount()
  document.body.innerHTML = ''
})

const settle = async (): Promise<void> => {
  await flushPromises()
  await nextTick()
}

// ── The picker ───────────────────────────────────────────────────────────────

const options = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))

const optionTexts = (): string[] => options().map((o) => o.textContent?.trim() ?? '')

const search = async (query: string): Promise<void> => {
  const input = document.querySelector<HTMLInputElement>('.search-bar__input')!
  input.value = query
  input.dispatchEvent(new Event('input'))
  await nextTick()
}

const mountPicker = async (language: string, catalogue: DictionaryCatalogue | null = CATALOGUE) => {
  seedCatalogue(catalogue)
  const wrapper = mount(LanguageModal, {
    props: { open: true, modelValue: language },
    global: { plugins: [i18n, [VueQueryPlugin, { queryClient }]] },
    attachTo: document.body
  })
  mounted.push(wrapper)
  await settle()
  return wrapper
}

describe('the language picker', () => {
  it('offers the catalogue’s names, never the keys behind them', async () => {
    await mountPicker('english')

    expect(optionTexts()).toEqual(['English', 'Russian (pre-reform)', 'CSS (code)'])
    expect(optionTexts()).not.toContain('code_css')
    expect(optionTexts()).not.toContain('russian_empire')
  })

  it('selects the KEY the config speaks, not the name it showed', async () => {
    const wrapper = await mountPicker('english')

    options()
      .find((o) => o.textContent?.trim() === 'CSS (code)')!
      .click()
    await settle()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['code_css'])
  })

  it('marks the current selection by key, so a key-valued config lights the right row', async () => {
    await mountPicker('code_css')

    const selected = options().filter((o) => o.getAttribute('aria-selected') === 'true')
    expect(selected.map((o) => o.textContent?.trim())).toEqual(['CSS (code)'])
  })

  it('searches the display name', async () => {
    await mountPicker('english')

    // "pre-reform" appears in the NAME only — the key is `russian_empire`.
    await search('pre-reform')
    expect(optionTexts()).toEqual(['Russian (pre-reform)'])
  })

  it('searches the key too — someone who knows `code_css` must still find it', async () => {
    await mountPicker('english')

    await search('code_css')
    expect(optionTexts()).toEqual(['CSS (code)'])

    // And a key fragment that appears in no name at all.
    await search('russian_emp')
    expect(optionTexts()).toEqual(['Russian (pre-reform)'])
  })

  it('shows the current key only while there is no catalogue to name it', async () => {
    await mountPicker('code_css', null)

    // Never an empty list: an identifier on screen beats nothing to pick from.
    expect(optionTexts()).toEqual(['code_css'])
  })
})

// ── The bucket picker ────────────────────────────────────────────────────────

const LANGUAGE_BOARD: BucketInfo = {
  bucket: 'time:15000:code_css:seeded',
  mode: 'time',
  durationMs: 15_000,
  lang: 'code_css',
  textSource: 'seeded',
  entries: 4
}

const QUOTE_BOARD: BucketInfo = {
  bucket: 'quote:0a6c0103-89c8-43be-bd66-1371216d4a53',
  quoteId: '0a6c0103-89c8-43be-bd66-1371216d4a53',
  entries: 2
}

const mountBuckets = async (
  selected: string,
  catalogue: DictionaryCatalogue | null = CATALOGUE
) => {
  seedCatalogue(catalogue)
  const wrapper = mount(BoardBucketPicker, {
    props: { buckets: [LANGUAGE_BOARD, QUOTE_BOARD], selected },
    global: { plugins: [i18n, [VueQueryPlugin, { queryClient }]] }
  })
  mounted.push(wrapper)
  await settle()
  return wrapper
}

const triggerText = (wrapper: { get: (s: string) => { text: () => string } }): string =>
  wrapper.get('[data-testid="boards-bucket-picker"]').text()

describe('the leaderboard bucket picker', () => {
  it('names a language board the way the catalogue names the language', async () => {
    const wrapper = await mountBuckets(LANGUAGE_BOARD.bucket)

    expect(triggerText(wrapper)).toContain('15s · CSS (code)')
    expect(triggerText(wrapper)).not.toContain('code_css')
  })

  it('falls back to the key when the catalogue has not loaded', async () => {
    const wrapper = await mountBuckets(LANGUAGE_BOARD.bucket, null)

    expect(triggerText(wrapper)).toContain('15s · code_css')
  })

  it('leaves a quote board named by its id stem — it has no language at all', async () => {
    const wrapper = await mountBuckets(QUOTE_BOARD.bucket)

    expect(triggerText(wrapper)).toContain('quote · 0a6c0103')
  })
})

// ── The contract ─────────────────────────────────────────────────────────────

describe('the catalogue contract', () => {
  const row = (over: Record<string, unknown> = {}): unknown => ({
    lang: 'code_css',
    name: 'CSS (code)',
    dictHash: '55ccd317',
    wordCount: 72,
    bytes: 1234,
    ...over
  })

  it('accepts a row that carries both halves', () => {
    const parsed = v.parse(DictionarySchema, row())
    expect(parsed.lang).toBe('code_css')
    expect(parsed.name).toBe('CSS (code)')
  })

  /**
   * The rename `css_code -> code_css` is a rename of the KEY and nothing else.
   * `dictHash` is FNV-1a over the word list, the word list did not move, so the
   * body address did not move either — which is what keeps every run recorded
   * before the rename replayable against the dictionary it was actually played
   * on. A run's replay resolves by hash, never by language.
   */
  it('does not move the body address when the key is renamed', () => {
    const css = v.parse(DictionaryCatalogueSchema, CATALOGUE).find((d) => d.lang === 'code_css')

    expect(css?.dictHash).toBe('55ccd317')
  })

  it('rejects a row with no name — there would be nothing honest to render', () => {
    const { name: _dropped, ...nameless } = row() as Record<string, unknown>
    expect(() => v.parse(DictionarySchema, nameless)).toThrow()
  })

  it('rejects an EMPTY name rather than letting the key stand in for it', () => {
    expect(() => v.parse(DictionarySchema, row({ name: '' }))).toThrow()
  })

  it('takes a whole catalogue of named rows', () => {
    expect(v.parse(DictionaryCatalogueSchema, CATALOGUE)).toEqual(CATALOGUE)
  })
})
