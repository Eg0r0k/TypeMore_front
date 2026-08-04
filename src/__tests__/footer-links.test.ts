/**
 * The shared `Link`, and the footer row that is its first list-shaped caller.
 *
 * `Link` has to answer one question before anything else: does this
 * destination leave the app? A RouterLink cannot express `https://…` — the
 * router resolves it as a path and lands on the catch-all — so the answer
 * decides which element is rendered at all. The footer is the reason that
 * matters: it holds an external url and three in-app paths in ONE list, and
 * before this it rendered every one of them as a `Button` with no href, so
 * nothing in the row actually went anywhere.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { Link } from '@/shared/ui/link'
import { FooterLinks } from '@/features/footer/links'
import { FOOTER_LINKS } from '@/widgets/footer/model/const/values'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div />' } },
    { path: '/:pathMatch(.*)*', name: 'error', component: { template: '<div />' } }
  ]
})

const mountLink = (props: Record<string, unknown>) =>
  mount(Link, { props: props as never, slots: { default: 'go' }, global: { plugins: [router] } })

describe('Link', () => {
  it('renders an in-app destination as a router link', async () => {
    await router.push('/')
    const wrapper = mountLink({ to: { name: 'home' } })
    expect(wrapper.find('a').attributes('href')).toBe('/')
    // Not opened in a new tab: it is the same app.
    expect(wrapper.find('a').attributes('target')).toBeUndefined()
  })

  it('renders an outbound url as an anchor, isolated from the opener', () => {
    const wrapper = mountLink({ to: 'https://github.com/Eg0r0k' })
    const anchor = wrapper.find('a')
    expect(anchor.attributes('href')).toBe('https://github.com/Eg0r0k')
    expect(anchor.attributes('target')).toBe('_blank')
    expect(anchor.attributes('rel')).toBe('noopener noreferrer')
  })

  it('lets the caller override the defaults it chose for it', () => {
    const wrapper = mountLink({ to: 'https://example.com', target: '_self' })
    expect(wrapper.find('a').attributes('target')).toBe('_self')
    // No new tab means nothing to isolate, so no rel is invented.
    expect(wrapper.find('a').attributes('rel')).toBeUndefined()
  })
})

describe('footer links', () => {
  it('gives every entry a real href', async () => {
    await router.push('/')
    const wrapper = mount(FooterLinks, {
      props: { links: FOOTER_LINKS },
      global: { plugins: [router] }
    })

    const anchors = wrapper.findAll('a')
    expect(anchors).toHaveLength(FOOTER_LINKS.length)
    for (const anchor of anchors) {
      const href = anchor.attributes('href')
      expect(href, 'a footer entry with no href goes nowhere').toBeTruthy()
      // Absolute or outbound — never a bare word, which vue-router would
      // resolve against whatever page the footer happens to be under.
      expect(href!.startsWith('/') || href!.startsWith('http')).toBe(true)
    }
  })

  it('names every entry even when its label is off screen', () => {
    const wrapper = mount(FooterLinks, {
      props: { links: FOOTER_LINKS },
      global: { plugins: [router] }
    })
    // The visible label is `display: none` on a narrow screen, which hides it
    // from assistive tech too — the sr-only copy is what survives.
    expect(wrapper.findAll('.sr-only').map((s) => s.text())).toEqual(
      FOOTER_LINKS.map((link) => link.label)
    )
  })
})
