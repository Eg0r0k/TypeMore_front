/**
 * Chat scroll pinning: new messages auto-follow ONLY while the view sits at
 * the bottom. Scrolled up to read history, the log stays put and arrivals
 * surface as the "new messages" pill; the pill scrolls back down and clears.
 * A cleared log (a new room's chat) resets the pill with it.
 *
 * happy-dom reports zero scroll geometry, so the scrolled-up state is
 * simulated by defining the metrics on the container instance and firing a
 * real scroll event through the component's own handler.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import { i18n } from '@app/i18n'

const h = vi.hoisted(() => ({
  store: {} as {
    chatLog: { id: string; from: string; text: string; ts: number }[]
    selfId: string
    room: { players: [] } | null
    lastError: null
    sendChat: () => void
  }
}))

vi.mock('@/entities/match', () => ({
  useMatchSessionStore: () => h.store
}))

import { RoomChat } from '@/features/room/chat'

const noopDirective = {}
let messageCounter = 0

function mountChat() {
  h.store = reactive({
    chatLog: [],
    selfId: 'me',
    room: { players: [] as [] },
    lastError: null,
    sendChat: vi.fn()
  })
  return mount(RoomChat, {
    global: {
      plugins: [i18n],
      directives: { 'max-chars': noopDirective }
    },
    attachTo: document.body
  })
}

function pushMessage(text: string): void {
  messageCounter += 1
  h.store.chatLog.push({ id: `m-${messageCounter}`, from: 'p1', text, ts: 0 })
}

/** Make the container report a scrolled-up position and fire its handler. */
async function scrollUp(wrapper: ReturnType<typeof mountChat>): Promise<void> {
  const container = wrapper.find('.scrollable').element as HTMLElement
  Object.defineProperty(container, 'scrollHeight', { configurable: true, get: () => 1000 })
  Object.defineProperty(container, 'clientHeight', { configurable: true, get: () => 200 })
  Object.defineProperty(container, 'scrollTop', {
    configurable: true,
    get: () => 100,
    set: () => undefined
  })
  container.scrollTo = () => undefined
  await wrapper.find('.scrollable').trigger('scroll')
}

const pill = (wrapper: ReturnType<typeof mountChat>) =>
  wrapper.find('[data-testid="chat-new-messages"]')

describe('room chat — scroll pinning and the new-messages pill', () => {
  it('shows no pill while the view is pinned to the bottom', async () => {
    const wrapper = mountChat()
    pushMessage('hello')
    await nextTick()
    expect(pill(wrapper).exists()).toBe(false)
    wrapper.unmount()
  })

  it('scrolled up: arrivals raise the pill instead of scrolling', async () => {
    const wrapper = mountChat()
    pushMessage('first')
    await nextTick()
    await scrollUp(wrapper)

    pushMessage('second')
    pushMessage('third')
    await nextTick()

    expect(pill(wrapper).exists()).toBe(true)
    wrapper.unmount()
  })

  it('the pill scrolls down and clears itself on click', async () => {
    const wrapper = mountChat()
    pushMessage('first')
    await nextTick()
    await scrollUp(wrapper)
    pushMessage('second')
    await nextTick()
    expect(pill(wrapper).exists()).toBe(true)

    await pill(wrapper).trigger('click')
    expect(pill(wrapper).exists()).toBe(false)
    wrapper.unmount()
  })

  it('a cleared log (a new room) resets the pill', async () => {
    const wrapper = mountChat()
    pushMessage('old room talk')
    await nextTick()
    await scrollUp(wrapper)
    pushMessage('more talk')
    await nextTick()
    expect(pill(wrapper).exists()).toBe(true)

    h.store.chatLog.splice(0)
    await nextTick()
    expect(pill(wrapper).exists()).toBe(false)
    wrapper.unmount()
  })
})
