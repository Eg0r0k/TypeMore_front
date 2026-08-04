/**
 * "Copy profile link". The confirmation is the BUTTON'S OWN tooltip — not a
 * toast — so what these assert is that the tooltip says "copied" after a click
 * and goes back to its label on its own, and that what lands on the clipboard
 * is the canonical public url rather than whatever the address bar happens to
 * hold.
 */
import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { i18n } from '@app/i18n'
import { ROUTE_NAMES } from '@/shared/router'
import { TooltipProvider } from '@/shared/ui/tooltip'
import { ProfileCopyLink } from '@/features/profile'

const writeText = vi.fn<(text: string) => Promise<void>>()

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/u/:name', name: ROUTE_NAMES.USER, component: { template: '<div />' } }
  ]
})

const mountButton = async () => {
  await router.push('/?bucket=time-15000-en-US')
  await router.isReady()
  const wrapper = mount(TooltipProvider, {
    props: { delayDuration: 0 },
    slots: { default: () => h(ProfileCopyLink, { name: 'egor' }) },
    global: { plugins: [i18n, router] },
    attachTo: document.body
  })
  await nextTick()
  return wrapper
}

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  vi.useFakeTimers()
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('ProfileCopyLink', () => {
  it('copies the canonical public url, not the current location', async () => {
    const wrapper = await mountButton()

    await wrapper.find('[data-testid="profile-copy-link"]').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledOnce()
    const copied = writeText.mock.calls[0][0]
    expect(copied).toContain('/u/egor')
    // The page's own query has no business in a link somebody pastes.
    expect(copied).not.toContain('bucket=')
    expect(copied.startsWith('http')).toBe(true)

    wrapper.unmount()
  })

  it('confirms on the button’s own tooltip and reverts by itself', async () => {
    const wrapper = await mountButton()
    const copiedLabel = i18n.global.t('profile.copyLink.copied')
    // The tooltip's own node survives its close animation, so the CONFIRMED
    // state is read off the button (its icon), not off the document's text.
    const confirmed = () => wrapper.find('[data-testid="profile-copy-link-done"]').exists()

    expect(confirmed()).toBe(false)

    await wrapper.find('[data-testid="profile-copy-link"]').trigger('click')
    await flushPromises()
    await nextTick()
    expect(confirmed()).toBe(true)
    expect(document.body.textContent).toContain(copiedLabel)

    // ~1.5s later it is a plain button again — nothing to dismiss by hand.
    vi.advanceTimersByTime(1500)
    await nextTick()
    expect(confirmed()).toBe(false)

    wrapper.unmount()
  })

  it('says nothing when the clipboard refuses', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'))
    const wrapper = await mountButton()

    await wrapper.find('[data-testid="profile-copy-link"]').trigger('click')
    await flushPromises()
    await nextTick()

    // No false confirmation: the link is still in the address bar, and
    // claiming a copy that did not happen is the one unacceptable outcome.
    expect(wrapper.find('[data-testid="profile-copy-link-done"]').exists()).toBe(false)

    wrapper.unmount()
  })
})
