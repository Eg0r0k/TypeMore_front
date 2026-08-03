/**
 * Display canaries × the render layer and the input adapter.
 *
 * Three contracts:
 * 1. TestWord: the canary is TEXT inside the letter span before its slot —
 *    span count, span order and class assignment are byte-identical to the
 *    canary-free render (caret geometry is measured per span; real pixel
 *    invariance is the e2e canary-layout spec, happy-dom has no layout).
 * 2. GameField: `canarySeed` weaves the schedule into the windowed words;
 *    `null` and viewOnly render clean; a NEW seed over the SAME words
 *    re-renders (the v-memo carries `canaryKey`).
 * 3. The trap itself: a bot that scrapes the rendered word and types it back
 *    through the real TestInput commits at the canary slot (ZWSP) and logs
 *    the literal U+2063 insert; honest canonical input produces neither.
 */
import { mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

import { Test } from '@/widgets/test'
import { TestWord } from '@/features/test/word'
import { TestInput } from '@/features/test/input'
import type { GameSession } from '@entities/game'
import {
  CANARY_DIRECT,
  CANARY_SOFT,
  type Canary,
  type GameState,
  asMs,
  asSeq,
  canaryAt
} from '@typemore/core'
import { config } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import en from '@/app/i18n/locales/en'

config.global.plugins.push(createI18n({ legacy: false, locale: 'en', messages: { en } }))

let pinia: ReturnType<typeof createPinia>
beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

const state = (input: string[] = ['']): GameState => ({
  phase: 'running',
  wordIndex: 0,
  input,
  startedAt: asMs(0),
  finishedAt: null,
  lastSeq: asSeq(1),
  failReason: null
})

/** What a scraper reads off a word box (the e2e specs use the same squash). */
const scrape = (wrapper: VueWrapper): string => wrapper.element.textContent!.replace(/\s+/g, '')

// ── 1. TestWord ─────────────────────────────────────────────────────────────

describe('TestWord canary rendering', () => {
  const word = 'question'
  const canary: Canary = { slot: 3, grapheme: CANARY_SOFT }

  const mountWord = (extra: Record<string, unknown> = {}) =>
    mount(TestWord, { props: { word, typed: 'que', active: true, ...extra } })

  it('keeps span count, order and classes identical with and without a canary', () => {
    const plain = mountWord()
    const trapped = mountWord({ canary })
    const plainLetters = plain.findAll('.letter')
    const trappedLetters = trapped.findAll('.letter')
    expect(trappedLetters).toHaveLength(plainLetters.length)
    for (let i = 0; i < plainLetters.length; i++) {
      expect(trappedLetters[i].classes()).toEqual(plainLetters[i].classes())
    }
  })

  it('appends the grapheme to the text of the span BEFORE the slot, and only there', () => {
    const trapped = mountWord({ canary })
    const letters = trapped.findAll('.letter')
    for (let i = 0; i < letters.length; i++) {
      const text = letters[i].text()
      if (i === canary.slot - 1) expect(text).toBe(word[i] + CANARY_SOFT)
      else expect(text).toBe(word[i])
    }
    // The scraped text carries the canary exactly at offset `slot`.
    expect(scrape(trapped)).toBe(word.slice(0, canary.slot) + CANARY_SOFT + word.slice(canary.slot))
  })

  it('never decorates extra (over-typed) letters', () => {
    // Canary at the LAST interior slot; the player over-typed past the target.
    const overTyped = mount(TestWord, {
      props: {
        word: 'abcd',
        typed: 'abcdXY',
        active: true,
        canary: { slot: 3, grapheme: CANARY_DIRECT } satisfies Canary
      }
    })
    const letters = overTyped.findAll('.letter')
    expect(letters).toHaveLength(6) // 4 target + 2 extra — count untouched
    expect(letters[2].text()).toBe('c' + CANARY_DIRECT)
    expect(letters[4].text()).toBe('X')
    expect(letters[5].text()).toBe('Y')
  })
})

// ── 2. GameField ────────────────────────────────────────────────────────────

interface MutableView {
  snapshot: GameState
  words: readonly string[]
  wordIndex: number
  finished: boolean
  blind: boolean
}

const makeView = (words: readonly string[]): MutableView =>
  reactive<MutableView>({
    snapshot: { ...state(['']), input: [''] },
    words,
    wordIndex: 0,
    finished: false,
    blind: false
  })

const shadowWords = (wrapper: VueWrapper): string[] => {
  const root = (wrapper.find('.game__host').element as HTMLElement).shadowRoot
  return Array.from(root?.querySelectorAll('.word') ?? []).map((el) =>
    (el.textContent ?? '').replace(/\s+/g, '')
  )
}

const expectedScrape = (seed: number | null, index: number, word: string): string => {
  const canary = seed === null ? null : canaryAt(seed, index, word)
  return canary === null
    ? word
    : word.slice(0, canary.slot) + canary.grapheme + word.slice(canary.slot)
}

/** A seed under which at least one of `words` draws a canary. */
const seedWithCanary = (words: readonly string[]): number => {
  for (let seed = 1; seed < 2000; seed++) {
    if (words.some((word, i) => canaryAt(seed, i, word) !== null)) return seed
  }
  throw new Error('no seed draws a canary on these words')
}

describe('GameField canarySeed', () => {
  const words = ['question', 'attention', 'privet', 'wordlike', 'sentence', 'grapheme'] as const

  const mountField = (props: Record<string, unknown> = {}) =>
    mount(Test, {
      props: { store: makeView(words), viewOnly: true, shadowMode: 'open' as const, ...props },
      attachTo: document.body
    })

  it('renders clean words by default (no seed) and for an explicit null', async () => {
    for (const props of [{}, { canarySeed: null }]) {
      const wrapper = mountField(props)
      await nextTick()
      await nextTick()
      expect(shadowWords(wrapper)).toEqual([...words])
      wrapper.unmount()
    }
  })

  it('viewOnly ignores the seed unconditionally', async () => {
    const seed = seedWithCanary(words)
    const wrapper = mountField({ canarySeed: seed }) // viewOnly: true above
    await nextTick()
    await nextTick()
    expect(shadowWords(wrapper)).toEqual([...words])
    wrapper.unmount()
  })

  it('a playable field weaves the schedule into the rendered words', async () => {
    const seed = seedWithCanary(words)
    const session = Object.assign(makeView(words), {
      insert: vi.fn(),
      replace: vi.fn(),
      deleteBackward: vi.fn(),
      commit: vi.fn()
    })
    const wrapper = mount(Test, {
      props: { store: session as unknown as GameSession, shadowMode: 'open' as const, canarySeed: seed },
      global: { plugins: [pinia] },
      attachTo: document.body
    })
    await nextTick()
    await nextTick()
    expect(shadowWords(wrapper)).toEqual(words.map((w, i) => expectedScrape(seed, i, w)))
    wrapper.unmount()
  })

  it('a restart with the same words under a NEW seed re-renders the schedule (v-memo key)', async () => {
    const seedA = seedWithCanary(words)
    let seedB = -1
    for (let s = seedA + 1; s < 5000; s++) {
      const layoutA = words.map((w, i) => expectedScrape(seedA, i, w)).join(' ')
      const layoutS = words.map((w, i) => expectedScrape(s, i, w)).join(' ')
      if (layoutS !== layoutA) {
        seedB = s
        break
      }
    }
    expect(seedB).toBeGreaterThan(0)

    const session = Object.assign(makeView(words), {
      insert: vi.fn(),
      replace: vi.fn(),
      deleteBackward: vi.fn(),
      commit: vi.fn()
    })
    const wrapper = mount(Test, {
      props: { store: session as unknown as GameSession, shadowMode: 'open' as const, canarySeed: seedA },
      global: { plugins: [pinia] },
      attachTo: document.body
    })
    await nextTick()
    await nextTick()
    expect(shadowWords(wrapper)).toEqual(words.map((w, i) => expectedScrape(seedA, i, w)))

    await wrapper.setProps({ canarySeed: seedB })
    await nextTick()
    expect(shadowWords(wrapper)).toEqual(words.map((w, i) => expectedScrape(seedB, i, w)))
    wrapper.unmount()
  })
})

// ── 3. The bot against the adapter ──────────────────────────────────────────

/**
 * A stateful GameSession fake: the adapter reads `snapshot.input`, `words`,
 * `wordIndex` and calls `insert`/`commit` — this mirrors the real store's
 * bookkeeping for exactly those, recording what reached the log.
 */
function statefulSession(words: readonly string[]): {
  session: GameSession
  inserts: string[]
  commits: { wordIndex: number; bufferLen: number }[]
} {
  const inserts: string[] = []
  const commits: { wordIndex: number; bufferLen: number }[] = []
  const s = reactive({
    snapshot: state(['']),
    words,
    wordIndex: 0,
    finished: false,
    blind: false,
    insert(text: string) {
      inserts.push(text)
      const input = [...s.snapshot.input]
      input[s.wordIndex] = (input[s.wordIndex] ?? '') + text
      s.snapshot = { ...s.snapshot, input }
    },
    replace: vi.fn(),
    deleteBackward: vi.fn(),
    commit() {
      commits.push({
        wordIndex: s.wordIndex,
        bufferLen: (s.snapshot.input[s.wordIndex] ?? '').length
      })
      const input = [...s.snapshot.input]
      s.wordIndex += 1
      input[s.wordIndex] = input[s.wordIndex] ?? ''
      s.snapshot = { ...s.snapshot, wordIndex: s.wordIndex, input }
    },
    keyDown: vi.fn(),
    keyUp: vi.fn()
  })
  return { session: s as unknown as GameSession, inserts, commits }
}

describe('a bot typing the scraped render is caught by the adapter itself', () => {
  const typeAll = async (wrapper: VueWrapper, text: string): Promise<void> => {
    for (const ch of text) {
      await wrapper
        .find('textarea')
        .trigger('beforeinput', { inputType: 'insertText', data: ch })
    }
  }

  it('ZWSP (soft canary) forces the commit exactly at the slot', async () => {
    const word = 'question'
    const canary: Canary = { slot: 5, grapheme: CANARY_SOFT }
    // The bot's source of truth: the RENDERED word.
    const rendered = mount(TestWord, { props: { word, typed: '', active: true, canary } })
    const scraped = scrape(rendered)
    expect(scraped).toBe(word.slice(0, 5) + CANARY_SOFT + word.slice(5))

    const { session, inserts, commits } = statefulSession([word, 'next'])
    const wrapper = mount(TestInput, {
      props: { store: session },
      global: { plugins: [pinia] },
      attachTo: document.body
    })
    await typeAll(wrapper, scraped)

    // The invisible "space" committed the half-typed word at the slot…
    expect(commits).toEqual([{ wordIndex: 0, bufferLen: 5 }])
    // …and the ZWSP itself never reached the log as text.
    expect(inserts.join('')).not.toContain(CANARY_SOFT)
    wrapper.unmount()
  })

  it('U+2063 (direct canary) lands in the log as a literal insert', async () => {
    const word = 'question'
    const canary: Canary = { slot: 3, grapheme: CANARY_DIRECT }
    const rendered = mount(TestWord, { props: { word, typed: '', active: true, canary } })
    const scraped = scrape(rendered)

    const { session, inserts, commits } = statefulSession([word, 'next'])
    const wrapper = mount(TestInput, {
      props: { store: session },
      global: { plugins: [pinia] },
      attachTo: document.body
    })
    await typeAll(wrapper, scraped)

    expect(inserts).toContain(CANARY_DIRECT)
    expect(commits).toEqual([]) // no separator typed — no commit
    wrapper.unmount()
  })

  it('honest canonical input produces not a single extra event', async () => {
    const word = 'question'
    const { session, inserts, commits } = statefulSession([word, 'next'])
    const wrapper = mount(TestInput, {
      props: { store: session },
      global: { plugins: [pinia] },
      attachTo: document.body
    })
    await typeAll(wrapper, word)
    await wrapper.find('textarea').trigger('keydown', { key: ' ', code: 'Space' })

    expect(inserts).toEqual([...word])
    expect(commits).toEqual([{ wordIndex: 0, bufferLen: word.length }])
    wrapper.unmount()
  })
})
