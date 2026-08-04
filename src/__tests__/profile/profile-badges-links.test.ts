/**
 * The identity half INSIDE the profile header: the badge showcase, the bio, the
 * board and the links.
 *
 * Two properties matter more than the markup. A badge CODE this build cannot
 * draw must render as nothing — a grant of a retired code is a real row the
 * server keeps serving forever, and a client one deploy behind will meet codes
 * it has never heard of. And a link must be built from the prefix THIS app
 * owns, never from anything the user typed, because that prefix list is the
 * entire set of hosts the product can send a reader to.
 */
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { ProfileSummary } from '@shared/api'
import { ProfileSummaryCard } from '@/features/profile'
import { BADGE_CODES, badgeOf, badgesOf } from '@/entities/badge'
import { LINK_PREFIXES, linkUrl } from '@shared/api'
import en from '@/app/i18n/locales/en'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div />' } },
    { path: '/u/:name', name: 'user', component: { template: '<div />' } }
  ]
})

const summary: ProfileSummary = {
  displayName: 'boardsmoke',
  joined: '2026-07-01T10:00:00Z',
  testsStarted: 10,
  testsCompleted: 10,
  restartsPerCompleted: 0,
  timeTypingMs: 60_000,
  estimatedWordsTyped: 100,
  wpm: { highest: 100, average: 90, averageLast10: 95 },
  raw: { highest: 110, average: 100, averageLast10: 105 },
  acc: { highest: 1, average: 0.96, averageLast10: 0.97 },
  consistency: { highest: 0.8, average: 0.7, averageLast10: 0.75 },
  streak: { current: 1, best: 2 },
  languages: [{ lang: 'english', tests: 10 }]
}

/** The header, rendered with whatever identity half the page hands it. */
const mountIdentity = (props: Record<string, unknown>) =>
  mount(ProfileSummaryCard, {
    props: { summary, part: 'identity', ...props },
    global: { plugins: [i18n, router, createPinia()] }
  })

describe('badge registry', () => {
  it('defines every code it lists', () => {
    for (const code of BADGE_CODES) {
      const badge = badgeOf(code)
      expect(badge, `${code} must have a definition`).not.toBeNull()
      expect(badge!.name).not.toBe('')
      expect(badge!.description).not.toBe('')
    }
  })

  it('answers null for a code this build has never heard of', () => {
    // Not a throw and not a placeholder: a retired grant is normal data that
    // the server will keep serving after the badge leaves this registry.
    expect(badgeOf('a_badge_from_the_future')).toBeNull()
    expect(badgeOf('')).toBeNull()
    expect(badgesOf(['staff', 'a_badge_from_the_future'])).toHaveLength(1)
  })
})

describe('the identity half in the header', () => {
  it('adds nothing to the header when the profile carries nothing', () => {
    const wrapper = mountIdentity({})
    // No empty showcase, no "no badges yet" placeholder, no blank bio line —
    // a header whose owner filled nothing in looks exactly as it did before
    // any of this existed.
    expect(wrapper.find('[data-testid="profile-badges"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="profile-bio"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="profile-keyboard"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="profile-copy-link"]').exists()).toBe(false)
    // And the header itself is still all there.
    expect(wrapper.find('[data-testid="profile-nick"]').text()).toBe('boardsmoke')
  })

  it('places each piece where its meaning puts it', () => {
    const wrapper = mountIdentity({
      badges: ['staff'],
      shareName: 'boardsmoke',
      canReport: true,
      bio: 'types words',
      keyboard: 'Keychron Q1',
      links: [{ kind: 'github', handle: 'egor' }]
    })
    const html = wrapper.html()

    // Badges on the name line, bio straight under it, keyboard under the meta,
    // and all of it above the counters.
    expect(html.indexOf('profile-badges')).toBeLessThan(html.indexOf('profile-bio'))
    expect(html.indexOf('profile-bio')).toBeLessThan(html.indexOf('profile-meta'))
    expect(html.indexOf('profile-meta')).toBeLessThan(html.indexOf('profile-keyboard'))
    expect(html.indexOf('profile-keyboard')).toBeLessThan(html.indexOf('profile-counters'))

    // The corner holds both buttons and the outbound links, in that order.
    expect(wrapper.find('[data-testid="profile-copy-link"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="profile-report"]').exists()).toBe(true)
    expect(html.indexOf('profile-copy-link')).toBeLessThan(html.indexOf('profile-link-github'))
  })

  it('asks the page to report rather than reporting itself', async () => {
    const wrapper = mountIdentity({ canReport: true })
    await wrapper.find('[data-testid="profile-report"]').trigger('click')
    expect(wrapper.emitted('report')).toHaveLength(1)
  })

  it('offers no report button when the page did not allow one', () => {
    // Your own page, an anonymous reader, or a header with no subject id: all
    // three are the page's judgement, and all three arrive here as `false`.
    expect(mountIdentity({}).find('[data-testid="profile-report"]').exists()).toBe(false)
  })

  it('draws the showcase in the order it was given, skipping unknown codes', () => {
    const wrapper = mountIdentity({ badges: ['translator', 'a_badge_from_the_future', 'staff'] })
    const chips = wrapper.findAll('[data-testid="badge-chip"]')
    expect(chips).toHaveLength(2)
    expect(chips.map((c) => c.attributes('data-badge'))).toEqual(['translator', 'staff'])
  })

  it('renders the bio as TEXT — no markup is interpreted', () => {
    const wrapper = mountIdentity({ bio: '<img src=x onerror=alert(1)> **not bold**' })
    const bio = wrapper.find('[data-testid="profile-bio"]')
    expect(bio.text()).toContain('<img src=x onerror=alert(1)>')
    expect(bio.html()).not.toContain('<img src')
  })

  it('builds every link from the prefix this app owns', () => {
    const wrapper = mountIdentity({
      links: [
        { kind: 'github', handle: 'egor' },
        { kind: 'twitch', handle: 'egor_kill' }
      ]
    })
    const github = wrapper.find('[data-testid="profile-link-github"]')
    expect(github.attributes('href')).toBe(LINK_PREFIXES.github + 'egor')
    // Every outbound link is isolated from the opener.
    expect(github.attributes('rel')).toBe('noopener noreferrer')
    expect(github.attributes('target')).toBe('_blank')
    // The visible text is the HANDLE — the url is the href's business.
    expect(github.text()).toBe('egor')
  })

  it('never lets a handle escape its prefix', () => {
    // The server refuses these; the client's own builder must not be the thing
    // that would have made them dangerous if one ever got through.
    for (const handle of ['../../evil', 'evil.example.com']) {
      expect(linkUrl('github', handle).startsWith(LINK_PREFIXES.github)).toBe(true)
    }
  })
})
