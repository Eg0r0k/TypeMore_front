/**
 * Which board `/boards` lands on, and what the URL says about it.
 *
 * The default is the busiest bucket; `?bucket=` overrides it when it names a
 * board that exists; and a `?bucket=` the catalogue does not contain is
 * corrected in place rather than left lying about what is on screen. The rail
 * adds two bucketless states, both linkable: `?source=quotes…` (the picker)
 * and `?lang=` naming a language with no boards.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, defineComponent, type PropType } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import type { BucketInfo } from '@shared/api'
import { ROUTE_NAMES } from '@/app/router/route-names'
import { useBoardsSelection } from '@/features/leaderboards'

const bucket = (key: string, entries: number): BucketInfo => {
  const [mode, dimension, lang] = key.split(':')
  return {
    bucket: key,
    mode: mode as 'time' | 'words',
    ...(mode === 'time' ? { durationMs: Number(dimension) } : { wordCount: Number(dimension) }),
    lang: lang ?? 'en',
    textSource: 'seeded',
    entries
  }
}

const TIME_15 = bucket('time:15000:en:seeded', 3)
const TIME_30 = bucket('time:30000:en:seeded', 9)
const TIME_60 = bucket('time:60000:en:seeded', 5)
const TIME_15_RU = bucket('time:15000:ru:seeded', 2)
const WORDS_25_RU = bucket('words:25:ru:seeded', 8)

const Harness = defineComponent({
  props: {
    buckets: { type: Array as PropType<BucketInfo[] | undefined>, default: undefined }
  },
  setup(props) {
    const selection = useBoardsSelection(computed(() => props.buckets))
    return { ...selection }
  },
  template: `<div>
    <span data-testid="selected">{{ selected ?? 'none' }}</span>
    <span data-testid="view">{{ view }}</span>
    <span data-testid="language">{{ language ?? 'none' }}</span>
    <span data-testid="source">{{ source }}</span>
    <span data-testid="group">{{ group }}</span>
  </div>`
})

const makeRouter = (): Router =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', redirect: '/boards' },
      { path: '/boards', name: ROUTE_NAMES.BOARDS, component: Harness }
    ]
  })

let router: Router

/**
 * Navigates first, THEN starts watching the router: the setup navigation is
 * scaffolding, and counting it would hide whether the composable itself
 * pushed or replaced.
 */
const mountAt = async (url: string, buckets: BucketInfo[] | undefined) => {
  await router.push(url)
  await router.isReady()
  const replace = vi.spyOn(router, 'replace')
  const push = vi.spyOn(router, 'push')
  const wrapper = mount(Harness, { props: { buckets }, global: { plugins: [router] } })
  await flushPromises()
  const read = (testid: string): string => wrapper.get(`[data-testid="${testid}"]`).text()
  return { wrapper, replace, push, read }
}

beforeEach(() => {
  router = makeRouter()
})

describe('bucket selection', () => {
  it('defaults to the most populated bucket', async () => {
    const { wrapper, read } = await mountAt('/boards', [TIME_15, TIME_30, TIME_60])

    expect(read('selected')).toBe(TIME_30.bucket)
    expect(read('view')).toBe('board')
    expect(read('language')).toBe('en')
    expect(read('source')).toBe('random')

    wrapper.unmount()
  })

  it('breaks an entry-count tie by bucket key, whatever order the server listed them in', async () => {
    // Same counts, opposite array orders. Anything that leans on the array's
    // order (a naive reduce, a stable sort on `entries` alone) lands on a
    // different board for each of these — which is exactly the bug that only
    // ever shows up in somebody else's session.
    const high = bucket('words:100:en:seeded', 7)
    const alsoHigh = bucket('time:15000:en:seeded', 7)

    const first = await mountAt('/boards', [high, alsoHigh])
    expect(first.read('selected')).toBe(alsoHigh.bucket)
    first.wrapper.unmount()

    router = makeRouter()
    const second = await mountAt('/boards', [alsoHigh, high])
    expect(second.read('selected')).toBe(alsoHigh.bucket)
    second.wrapper.unmount()
  })

  it('lets ?bucket= win over the default when the catalogue has it', async () => {
    const { wrapper, replace, read } = await mountAt(`/boards?bucket=${TIME_60.bucket}`, [
      TIME_15,
      TIME_30,
      TIME_60
    ])

    // TIME_30 is busier, but a shared link outranks the default.
    expect(read('selected')).toBe(TIME_60.bucket)
    expect(replace).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('falls back for an unknown ?bucket= and rewrites the query without a history entry', async () => {
    const { wrapper, replace, push, read } = await mountAt('/boards?bucket=time:99999:xx:seeded', [
      TIME_15,
      TIME_30
    ])

    expect(read('selected')).toBe(TIME_30.bucket)
    // The URL must not keep naming a board nobody is looking at.
    expect(router.currentRoute.value.query.bucket).toBe(TIME_30.bucket)
    expect(replace).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('leaves an address with no ?bucket= alone', async () => {
    const { wrapper, replace, read } = await mountAt('/boards', [TIME_15, TIME_30])

    expect(read('selected')).toBe(TIME_30.bucket)
    // Nothing false was claimed, so there is nothing to correct.
    expect(replace).not.toHaveBeenCalled()
    expect(router.currentRoute.value.query.bucket).toBeUndefined()

    wrapper.unmount()
  })

  it('selects nothing while the catalogue is unresolved or empty', async () => {
    const loading = await mountAt('/boards', undefined)
    expect(loading.read('selected')).toBe('none')
    loading.wrapper.unmount()

    router = makeRouter()
    const empty = await mountAt('/boards', [])
    expect(empty.read('selected')).toBe('none')
    empty.wrapper.unmount()
  })

  it('pushes a user-chosen bucket so Back returns to the previous board', async () => {
    const { wrapper, push, read } = await mountAt('/boards', [TIME_15, TIME_30])

    wrapper.vm.select(TIME_15.bucket)
    await flushPromises()

    expect(push).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.query.bucket).toBe(TIME_15.bucket)
    expect(read('selected')).toBe(TIME_15.bucket)

    wrapper.unmount()
  })
})

describe('quote buckets resolve by shape, not by catalogue membership', () => {
  const QUOTE_KEY = 'quote:1f5f1f2c-6f0f-4d5a-9f0a-3f2a1b0c9d8e'

  /**
   * REGRESSION — "open this quote's leaderboard" from the results screen. The
   * catalogue lists only boards with a visible entry; seconds after a run the
   * quote's board has none. Validating the key against the catalogue rewrote
   * the URL to the busiest language board, so the button never opened the
   * board it named.
   */
  it('keeps an unlisted quote bucket selected and does not rewrite the URL', async () => {
    const { wrapper, replace, read } = await mountAt(`/boards?bucket=${QUOTE_KEY}`, [
      TIME_15,
      TIME_30
    ])

    expect(read('selected')).toBe(QUOTE_KEY)
    expect(read('view')).toBe('board')
    expect(read('source')).toBe('quotes')
    expect(replace).not.toHaveBeenCalled()
    expect(router.currentRoute.value.query.bucket).toBe(QUOTE_KEY)

    wrapper.unmount()
  })

  it('resolves a quote bucket before the catalogue has answered at all', async () => {
    const { wrapper, read } = await mountAt(`/boards?bucket=${QUOTE_KEY}`, undefined)

    expect(read('selected')).toBe(QUOTE_KEY)

    wrapper.unmount()
  })

  it('still corrects a MALFORMED quote key like any other unknown bucket', async () => {
    // Uppercase uuid: the server stores and links the lowercase spelling;
    // ParseBucketKey rejects the rest (LEADERBOARDS.md), and so does the
    // client's shape test.
    const { wrapper, replace, read } = await mountAt(
      '/boards?bucket=quote:1F5F1F2C-6F0F-4D5A-9F0A-3F2A1B0C9D8E',
      [TIME_15, TIME_30]
    )

    expect(read('selected')).toBe(TIME_30.bucket)
    expect(replace).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })
})

describe('the rail groups in the URL', () => {
  const ALL = [TIME_15, TIME_30, TIME_60, TIME_15_RU, WORDS_25_RU]

  it('keeps the preset when the new language has it', async () => {
    const { wrapper } = await mountAt(`/boards?bucket=${TIME_15.bucket}`, ALL)

    wrapper.vm.selectLanguage('ru')
    await flushPromises()

    // 15s en → 15s ru, not ru's busier words board: the point of switching
    // language is comparing the SAME shape.
    expect(router.currentRoute.value.query.bucket).toBe(TIME_15_RU.bucket)

    wrapper.unmount()
  })

  it('falls back to the language’s busiest board when the preset is missing', async () => {
    const { wrapper } = await mountAt(`/boards?bucket=${TIME_60.bucket}`, ALL)

    wrapper.vm.selectLanguage('ru')
    await flushPromises()

    // ru has no 60s board; its busiest is words:25.
    expect(router.currentRoute.value.query.bucket).toBe(WORDS_25_RU.bucket)

    wrapper.unmount()
  })

  it('addresses a boardless language as ?lang= and shows the honest empty view', async () => {
    const { wrapper, read } = await mountAt(`/boards?bucket=${TIME_15.bucket}`, ALL)

    wrapper.vm.selectLanguage('de')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ lang: 'de' })
    expect(read('selected')).toBe('none')
    expect(read('view')).toBe('no-language-boards')
    expect(read('language')).toBe('de')

    wrapper.unmount()
  })

  it('opens the quote picker for the current language, bucketless', async () => {
    const { wrapper, read } = await mountAt(`/boards?bucket=${TIME_15_RU.bucket}`, ALL)

    wrapper.vm.selectSource('quotes')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ source: 'quotes', lang: 'ru' })
    expect(read('view')).toBe('quote-picker')
    expect(read('selected')).toBe('none')
    expect(read('source')).toBe('quotes')

    wrapper.unmount()
  })

  it('keeps the length filter in the URL and drops it at all', async () => {
    const { wrapper, read } = await mountAt('/boards?source=quotes&lang=ru&group=short', ALL)

    expect(read('group')).toBe('short')

    wrapper.vm.selectGroup('all')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ source: 'quotes', lang: 'ru' })
    expect(read('group')).toBe('all')

    wrapper.unmount()
  })

  it('treats an unknown ?group= as no filter rather than a 400 waiting to happen', async () => {
    const { wrapper, read } = await mountAt('/boards?source=quotes&lang=ru&group=gigantic', ALL)

    expect(read('group')).toBe('all')

    wrapper.unmount()
  })

  it('returns from quotes to the language’s busiest board', async () => {
    const { wrapper, read } = await mountAt('/boards?source=quotes&lang=ru', ALL)

    wrapper.vm.selectSource('random')
    await flushPromises()

    expect(router.currentRoute.value.query).toEqual({ bucket: WORDS_25_RU.bucket })
    expect(read('view')).toBe('board')

    wrapper.unmount()
  })
})
