/**
 * The public room list: its four states, the rule that polling costs nothing
 * while nobody is looking, and the two ways a room can be un-enterable.
 *
 * `@shared/api` and the match session store are mocked at the module level —
 * these tests are about the view's behaviour against the contract's SHAPES and
 * against the join it delegates to, not about transport or sockets.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, type Ref } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

import type { RoomListEntry, RoomListSettings } from '@shared/api'
import { i18n } from '@app/i18n'

const h = vi.hoisted(() => ({
  rooms: vi.fn(),
  languageNames: vi.fn(),
  joinRoom: vi.fn(),
  createRoom: vi.fn(),
  session: { connection: 'idle', room: null as unknown }
}))

const vis = vi.hoisted(() => ({
  ref: null as unknown as Ref<DocumentVisibilityState>
}))

// A real ref, so the component's `refetchInterval` computed actually tracks it
// — the point of the pause is that it is reactive, not that it is read once.
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  // `vi.mock` factories are hoisted above every static import, so `ref` cannot
  // be one — this is the module-loading boundary the exception exists for.
  const { ref } = await import('vue')
  vis.ref = ref<DocumentVisibilityState>('visible')
  return { ...actual, useDocumentVisibility: () => vis.ref }
})

vi.mock('@shared/api', () => ({
  ROOM_LIST_POLL_MS: 4000,
  // The real narrowing, not a stub: every row calls it, and the mutual
  // exclusion it encodes is exactly what the chip renders.
  roomDimension: (settings: RoomListSettings) => {
    if (settings.mode === 'time' && settings.durationMs !== undefined) {
      return { kind: 'time', durationMs: settings.durationMs }
    }
    if (settings.mode === 'words' && settings.wordCount !== undefined) {
      return { kind: 'words', wordCount: settings.wordCount }
    }
    return null
  },
  // The real factory `select`s `.rooms` out of the envelope; the view only ever
  // sees the array, so that is what the mock resolves.
  roomListQueryOptions: () => ({ queryKey: ['rooms'], queryFn: () => h.rooms() }),
  languageNamesQueryOptions: () => ({
    queryKey: ['language-names'],
    queryFn: () => h.languageNames()
  })
}))

vi.mock('@/entities/match', () => ({
  useMatchSessionStore: () => ({
    get connection() {
      return h.session.connection
    },
    get room() {
      return h.session.room
    },
    joinRoom: h.joinRoom,
    createRoom: h.createRoom
  })
}))

import { ServersLobby } from '@/features/servers/lobby'

const settings = (over: Partial<RoomListSettings> = {}): RoomListSettings =>
  ({ mode: 'time', durationMs: 30_000, lang: 'english', ...over }) as RoomListSettings

const room = (over: Partial<RoomListEntry> = {}): RoomListEntry => ({
  code: 'ABC123',
  name: 'friday night',
  playerCount: 2,
  maxPlayers: 5,
  inMatch: false,
  settings: settings(),
  ...over
})

let queryClient: QueryClient

const settle = async (): Promise<void> => {
  await flushPromises()
  await nextTick()
  await flushPromises()
}

const mountList = async () => {
  const wrapper = mount(ServersLobby, {
    global: { plugins: [i18n, [VueQueryPlugin, { queryClient }]] }
  })
  await settle()
  return wrapper
}

beforeEach(() => {
  h.rooms.mockReset()
  h.languageNames.mockReset()
  h.joinRoom.mockReset()
  h.createRoom.mockReset()
  h.session.connection = 'idle'
  h.session.room = null
  h.languageNames.mockResolvedValue({ english: 'English', russian: 'Russian' })
  vis.ref.value = 'visible'
  i18n.global.locale.value = 'en'
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } }
  })
})

afterEach(() => {
  queryClient.clear()
})

describe('servers lobby list', () => {
  it('shows the loading state while the list is in flight, and nothing else', async () => {
    // Never settles: the list stays in flight for the whole assertion.
    h.rooms.mockReturnValue(Promise.withResolvers<RoomListEntry[]>().promise)

    const wrapper = mount(ServersLobby, {
      global: { plugins: [i18n, [VueQueryPlugin, { queryClient }]] }
    })
    await nextTick()

    expect(wrapper.get('[data-testid="lobby-loading"]').text()).toBe(
      i18n.global.t('servers.lobby.loading')
    )
    expect(wrapper.find('[data-testid="lobby-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="lobby-empty"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="lobby-row"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('treats an empty list as an answer, and offers the action that fixes it', async () => {
    h.rooms.mockResolvedValue([])

    const wrapper = await mountList()

    expect(wrapper.get('[data-testid="lobby-empty"]').text()).toBe(
      i18n.global.t('servers.lobby.empty')
    )
    expect(wrapper.find('[data-testid="lobby-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="lobby-row"]').exists()).toBe(false)

    await wrapper.get('[data-testid="lobby-create"]').trigger('click')
    expect(h.createRoom).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('renders a room by name, seats, dimension and language, in server order', async () => {
    h.rooms.mockResolvedValue([
      room(),
      room({
        code: 'ZZZ999',
        name: 'word sprint',
        playerCount: 1,
        settings: settings({ mode: 'words', durationMs: undefined, wordCount: 25, lang: 'russian' })
      })
    ])

    const wrapper = await mountList()
    const rows = wrapper.findAll('[data-testid="lobby-row"]')

    expect(rows).toHaveLength(2)
    expect(rows[0].get('[data-testid="lobby-name"]').text()).toBe('friday night')
    expect(rows[0].get('[data-testid="lobby-players"]').text()).toBe('players 2/5')
    // Each mode names its dimension in its own unit — never a bare number.
    expect(rows[0].get('[data-testid="lobby-mode"]').text()).toBe('30s')
    expect(rows[1].get('[data-testid="lobby-mode"]').text()).toBe('25 words')
    expect(rows[0].find('[data-testid="lobby-in-match"]').exists()).toBe(false)
    expect(rows[0].find('[data-testid="lobby-reason"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('names the language from the catalogue, never by its key', async () => {
    h.rooms.mockResolvedValue([room({ settings: settings({ lang: 'russian' }) })])

    const wrapper = await mountList()
    const lang = wrapper.get('[data-testid="lobby-lang"]')

    expect(lang.text()).toBe('Russian')
    expect(lang.text()).not.toBe('russian')

    wrapper.unmount()
  })

  it('offers a retry when the list fails, and recovers on it', async () => {
    h.rooms.mockRejectedValueOnce(new Error('offline'))

    const wrapper = await mountList()

    expect(wrapper.get('[data-testid="lobby-error"]').text()).toBe(
      i18n.global.t('servers.lobby.error')
    )
    expect(wrapper.find('[data-testid="lobby-row"]').exists()).toBe(false)

    h.rooms.mockResolvedValue([room()])
    await wrapper.get('[data-testid="lobby-retry"]').trigger('click')
    await settle()

    expect(wrapper.find('[data-testid="lobby-error"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="lobby-row"]')).toHaveLength(1)

    wrapper.unmount()
  })

  it('joins through the session store with the row own code', async () => {
    h.rooms.mockResolvedValue([room(), room({ code: 'QWE456', name: 'the other one' })])

    const wrapper = await mountList()
    await wrapper.findAll('[data-testid="lobby-join"]')[1].trigger('click')

    expect(h.joinRoom).toHaveBeenCalledTimes(1)
    expect(h.joinRoom).toHaveBeenCalledWith('QWE456')

    wrapper.unmount()
  })

  it('disables a full room and says it is full', async () => {
    h.rooms.mockResolvedValue([room({ playerCount: 5, maxPlayers: 5 })])

    const wrapper = await mountList()
    const button = wrapper.get('[data-testid="lobby-join"]')

    expect(button.attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="lobby-reason"]').text()).toBe(
      i18n.global.t('servers.lobby.reason.full')
    )

    await button.trigger('click')
    expect(h.joinRoom).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('badges a running room, disables it, and says the match already started', async () => {
    h.rooms.mockResolvedValue([room({ inMatch: true, playerCount: 2, maxPlayers: 5 })])

    const wrapper = await mountList()
    const button = wrapper.get('[data-testid="lobby-join"]')

    expect(wrapper.get('[data-testid="lobby-in-match"]').text()).toBe(
      i18n.global.t('servers.lobby.inMatch')
    )
    expect(button.attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="lobby-reason"]').text()).toBe(
      i18n.global.t('servers.lobby.reason.inMatch')
    )

    await button.trigger('click')
    expect(h.joinRoom).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('says why a room with a free seat is still unreachable while the socket is down', async () => {
    h.session.connection = 'reconnecting'
    h.rooms.mockResolvedValue([room()])

    const wrapper = await mountList()

    expect(wrapper.get('[data-testid="lobby-join"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="lobby-reason"]').text()).toBe(
      i18n.global.t('servers.lobby.reason.offline')
    )

    wrapper.unmount()
  })

  it('polls while visible, stops while hidden, and picks back up on return', async () => {
    vi.useFakeTimers()
    h.rooms.mockResolvedValue([room()])

    const wrapper = mount(ServersLobby, {
      global: { plugins: [i18n, [VueQueryPlugin, { queryClient }]] }
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(h.rooms).toHaveBeenCalledTimes(1)

    // Visible: the interval fires.
    await vi.advanceTimersByTimeAsync(4000)
    expect(h.rooms).toHaveBeenCalledTimes(2)

    // Hidden: the timer is gone, not merely ignored — three windows pass and
    // the server is never asked again.
    vis.ref.value = 'hidden'
    await nextTick()
    await vi.advanceTimersByTimeAsync(12_000)
    expect(h.rooms).toHaveBeenCalledTimes(2)

    // Back on screen: polling resumes on the very next window.
    vis.ref.value = 'visible'
    await nextTick()
    await vi.advanceTimersByTimeAsync(4000)
    expect(h.rooms.mock.calls.length).toBeGreaterThan(2)

    wrapper.unmount()
    vi.useRealTimers()
  })
})
