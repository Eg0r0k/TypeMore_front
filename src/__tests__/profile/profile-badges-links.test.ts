/**
 * The profile's identity half on the client: the badge showcase, the bio, the
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
import { describe, expect, it } from 'vitest'
import { h } from 'vue'

import { i18n } from '@app/i18n'
import { TooltipProvider } from '@/shared/ui/tooltip'
import { ProfileIdentity } from '@/features/profile'
import { BADGE_CODES, badgeOf, badgesOf } from '@/entities/badge'
import { LINK_PREFIXES, linkUrl } from '@shared/api'

const mountIdentity = (props: Record<string, unknown>) =>
  mount(TooltipProvider, {
    props: { delayDuration: 0 },
    slots: { default: () => h(ProfileIdentity, props) },
    global: { plugins: [i18n] }
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

describe('ProfileIdentity', () => {
  it('renders nothing at all when the profile carries nothing', () => {
    const wrapper = mountIdentity({})
    expect(wrapper.find('[data-testid="profile-identity"]').exists()).toBe(false)
    // Specifically: no empty showcase and no "no badges yet" placeholder.
    expect(wrapper.text()).toBe('')
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
