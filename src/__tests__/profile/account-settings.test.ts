import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/app/i18n/locales/en'

/**
 * The account section of the settings dialog: two SERVER-persisted switches.
 * The `me` query is the state source, the PATCH mutation the only writer —
 * both mocked at the API boundary.
 */
const h = vi.hoisted(() => {
  class MockApiError extends Error {
    readonly status: number
    readonly code: string
    constructor(status: number, code: string) {
      super(code)
      this.status = status
      this.code = code
    }
  }
  return {
    MockApiError,
    me: vi.fn(),
    mutate: vi.fn(),
    rename: vi.fn(),
    mutationPending: { value: false },
    mutationError: { value: false }
  }
})

vi.mock('@shared/api', () => ({
  isApiError: (value: unknown): boolean => value instanceof h.MockApiError,
  meQueryOptions: () => ({ queryKey: ['me'], queryFn: h.me, retry: false }),
  useUpdateSettingsMutation: () => ({
    mutate: h.mutate,
    isPending: ref(h.mutationPending.value),
    isError: ref(h.mutationError.value)
  }),
  useChangeDisplayNameMutation: () => ({
    isPending: ref(false),
    mutate: (
      input: unknown,
      opts?: { onSuccess?: (r: unknown) => void; onError?: (e: unknown) => void }
    ) => {
      h.rename(input)?.then?.(
        (r: unknown) => opts?.onSuccess?.(r),
        (e: unknown) => opts?.onError?.(e)
      )
    }
  })
}))

import AccountSection from '@/features/modal/settings/parts/AccountSection.vue'
import { useAuthStore } from '@/entities/auth'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

const me = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  displayName: 'Ada',
  createdAt: '2026-07-01T00:00:00Z',
  restricted: false,
  profilePublic: true,
  keyboardPublic: false,
  ...over
})

const mountSection = (authed: boolean) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useAuthStore()
  if (authed) store.setAuthed()
  else store.setGuest()
  return mount(AccountSection, {
    global: {
      plugins: [
        i18n,
        pinia,
        [
          VueQueryPlugin,
          {
            queryClient: new QueryClient({
              defaultOptions: { queries: { retry: false, gcTime: 0 } }
            })
          }
        ]
      ]
    }
  })
}

beforeEach(() => {
  h.me.mockReset()
  h.mutate.mockReset()
  h.rename.mockReset()
  h.mutationPending.value = false
  h.mutationError.value = false
})

describe('settings — the nickname', () => {
  it('prefills the current name and renames only when the draft moved', async () => {
    h.me.mockResolvedValue(me())
    h.rename.mockResolvedValue(me({ displayName: 'Lovelace' }))
    const wrapper = mountSection(true)
    await flushPromises()

    const input = wrapper.get('[data-testid="settings-display-name"]')
    expect((input.element as HTMLInputElement).value).toBe('Ada')
    expect(
      wrapper.get('[data-testid="settings-display-name-save"]').attributes('disabled')
    ).toBeDefined()

    await input.setValue('  Lovelace  ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(h.rename).toHaveBeenCalledWith({ displayName: 'Lovelace' })
  })

  it('locks the field inside the 30-day window and names the reopening date', async () => {
    h.me.mockResolvedValue(me({ displayNameChangedAt: new Date().toISOString() }))
    const wrapper = mountSection(true)
    await flushPromises()

    expect(
      wrapper.get('[data-testid="settings-display-name"]').attributes('disabled')
    ).toBeDefined()
    expect(wrapper.find('[data-testid="settings-display-name-cooldown"]').exists()).toBe(true)
    expect(h.rename).not.toHaveBeenCalled()
  })

  it('says "taken" when the server does', async () => {
    h.me.mockResolvedValue(me())
    h.rename.mockImplementation(() => Promise.reject(new h.MockApiError(409, 'name_taken')))
    const wrapper = mountSection(true)
    await flushPromises()

    await wrapper.get('[data-testid="settings-display-name"]').setValue('Occupied')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[data-testid="settings-display-name-error"]').text()).toContain(
      'already in use'
    )
  })
})

describe('settings — account privacy switches', () => {
  it('anonymous: a sign-in hint, no switches, no /me request', async () => {
    const wrapper = mountSection(false)
    await flushPromises()
    expect(wrapper.find('[data-testid="settings-account-signin"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="settings-profile-public"]').exists()).toBe(false)
    expect(h.me).not.toHaveBeenCalled()
  })

  it('reflects the server state and PATCHes exactly the flipped switch', async () => {
    h.me.mockResolvedValue(me())
    const wrapper = mountSection(true)
    await flushPromises()

    const profileSwitch = wrapper.find('[data-testid="settings-profile-public"]')
    const keyboardSwitch = wrapper.find('[data-testid="settings-keyboard-public"]')
    expect(profileSwitch.attributes('aria-checked')).toBe('true')
    expect(keyboardSwitch.attributes('aria-checked')).toBe('false')

    await keyboardSwitch.trigger('click')
    // A partial body: only the flipped switch travels — flipping one must not
    // race (or need to know) the other.
    expect(h.mutate).toHaveBeenCalledWith({ keyboardPublic: true })
    expect(h.mutate).not.toHaveBeenCalledWith(expect.objectContaining({ profilePublic: false }))
  })

  it('a closed profile disables the portrait switch and says why', async () => {
    h.me.mockResolvedValue(me({ profilePublic: false, keyboardPublic: true }))
    const wrapper = mountSection(true)
    await flushPromises()

    const keyboardSwitch = wrapper.find('[data-testid="settings-keyboard-public"]')
    expect(keyboardSwitch.attributes('disabled')).toBeDefined()
    // Against the message, not a copy of it: the point is that the row explains
    // WHY it is disabled, and rewording the note should not fail this test.
    expect(wrapper.find('[data-testid="settings-keyboard-public-note"]').text()).toBe(
      en.settings.keyboardPublic.closedNote
    )

    // Disabled means disabled: a click PATCHes nothing.
    await keyboardSwitch.trigger('click')
    expect(h.mutate).not.toHaveBeenCalled()
  })
})
