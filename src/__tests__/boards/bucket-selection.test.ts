/**
 * Which board `/boards` lands on, and what the URL says about it.
 *
 * The default is the busiest bucket; `?bucket=` overrides it when it names a
 * board that exists; and a `?bucket=` the catalogue does not contain is
 * corrected in place rather than left lying about what is on screen.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, defineComponent, type PropType } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import type { BucketInfo } from '@shared/api'
import { ROUTE_NAMES } from '@/app/router/route-names'
import { useBucketSelection } from '@/features/leaderboards'

const bucket = (key: string, entries: number): BucketInfo => ({
  bucket: key,
  mode: 'time',
  durationMs: 15_000,
  lang: 'en',
  textSource: 'seeded',
  entries
})

const TIME_15 = bucket('time:15000:en:seeded', 3)
const TIME_30 = bucket('time:30000:en:seeded', 9)
const TIME_60 = bucket('time:60000:en:seeded', 5)

const Harness = defineComponent({
  props: {
    buckets: { type: Array as PropType<BucketInfo[] | undefined>, default: undefined }
  },
  setup(props) {
    const { selected, select } = useBucketSelection(computed(() => props.buckets))
    return { selected, select }
  },
  template: `<div data-testid="selected">{{ selected ?? 'none' }}</div>`
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
  return { wrapper, replace, push }
}

beforeEach(() => {
  router = makeRouter()
})

describe('bucket selection', () => {
  it('defaults to the most populated bucket', async () => {
    const { wrapper } = await mountAt('/boards', [TIME_15, TIME_30, TIME_60])

    expect(wrapper.get('[data-testid="selected"]').text()).toBe(TIME_30.bucket)

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
    expect(first.wrapper.get('[data-testid="selected"]').text()).toBe(alsoHigh.bucket)
    first.wrapper.unmount()

    router = makeRouter()
    const second = await mountAt('/boards', [alsoHigh, high])
    expect(second.wrapper.get('[data-testid="selected"]').text()).toBe(alsoHigh.bucket)
    second.wrapper.unmount()
  })

  it('lets ?bucket= win over the default when the catalogue has it', async () => {
    const { wrapper, replace } = await mountAt(`/boards?bucket=${TIME_60.bucket}`, [
      TIME_15,
      TIME_30,
      TIME_60
    ])

    // TIME_30 is busier, but a shared link outranks the default.
    expect(wrapper.get('[data-testid="selected"]').text()).toBe(TIME_60.bucket)
    expect(replace).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('falls back for an unknown ?bucket= and rewrites the query without a history entry', async () => {
    const { wrapper, replace, push } = await mountAt('/boards?bucket=time:99999:xx:seeded', [
      TIME_15,
      TIME_30
    ])

    expect(wrapper.get('[data-testid="selected"]').text()).toBe(TIME_30.bucket)
    // The URL must not keep naming a board nobody is looking at.
    expect(router.currentRoute.value.query.bucket).toBe(TIME_30.bucket)
    expect(replace).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('leaves an address with no ?bucket= alone', async () => {
    const { wrapper, replace } = await mountAt('/boards', [TIME_15, TIME_30])

    expect(wrapper.get('[data-testid="selected"]').text()).toBe(TIME_30.bucket)
    // Nothing false was claimed, so there is nothing to correct.
    expect(replace).not.toHaveBeenCalled()
    expect(router.currentRoute.value.query.bucket).toBeUndefined()

    wrapper.unmount()
  })

  it('selects nothing while the catalogue is unresolved or empty', async () => {
    const loading = await mountAt('/boards', undefined)
    expect(loading.wrapper.get('[data-testid="selected"]').text()).toBe('none')
    loading.wrapper.unmount()

    router = makeRouter()
    const empty = await mountAt('/boards', [])
    expect(empty.wrapper.get('[data-testid="selected"]').text()).toBe('none')
    empty.wrapper.unmount()
  })

  it('pushes a user-chosen bucket so Back returns to the previous board', async () => {
    const { wrapper, push } = await mountAt('/boards', [TIME_15, TIME_30])

    wrapper.vm.select(TIME_15.bucket)
    await flushPromises()

    expect(push).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.query.bucket).toBe(TIME_15.bucket)
    expect(wrapper.get('[data-testid="selected"]').text()).toBe(TIME_15.bucket)

    wrapper.unmount()
  })
})
