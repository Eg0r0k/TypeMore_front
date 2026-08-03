import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { Avatar, UserAvatar, avatarVariant } from '@/shared/ui/avatar'

/**
 * The avatar (shadcn-vue's, on this app's tokens).
 *
 * Two things are worth pinning. The SIZE contract: one component serves a 24px
 * chip and a 96px portrait, the caller's own class always wins over the size
 * variant, and the contents are sized in container units so they follow the box
 * whatever set it. And the PICTURE contract: no endpoint serves an avatar yet,
 * so every call site renders initials today — the day one does, the only thing
 * that changes is that `src` is no longer empty.
 */

describe('avatar — sizing', () => {
  it('is a container, so its contents can be a proportion of it', () => {
    // Not decoration: `36cqw` in the fallback means nothing without this.
    expect(avatarVariant()).toContain('@container')
  })

  it('takes a size variant, and lets the caller override it', () => {
    expect(mount(Avatar, { props: { size: 'xs' } }).classes()).toContain('size-6')
    // tailwind-merge drops the variant's size when the caller brings their own.
    const custom = mount(Avatar, { props: { size: 'xl', class: 'size-[72px]' } })
    expect(custom.classes()).toContain('size-[72px]')
    expect(custom.classes()).not.toContain('size-24')
  })
})

describe('avatar — what it shows for a player', () => {
  it('builds initials from a display name, one letter per word, at most two', () => {
    const of = (name: string) => mount(UserAvatar, { props: { name } }).text()
    expect(of('preview_you')).toBe('PY')
    expect(of('ada lovelace')).toBe('AL')
    expect(of('boardsmoke')).toBe('B')
    expect(of('Егор')).toBe('Е')
    // Three words still give two letters, not a monogram salad.
    expect(of('a b c')).toBe('AB')
  })

  it('renders its fallback AT ONCE, with no picture to wait for', () => {
    // reka never renders a fallback that was given a falsy `delayMs`: it starts
    // hidden and is revealed by a timer only a truthy delay sets. Passing 0
    // would leave an empty circle on every account that has no avatar.
    const wrapper = mount(UserAvatar, { props: {} })
    expect(wrapper.text()).toBe('')
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('renders no <img> until there is a picture to render', () => {
    expect(
      mount(UserAvatar, { props: { name: 'ada' } })
        .find('img')
        .exists()
    ).toBe(false)
  })

  it('is decoration next to a name, and an image with one when it stands alone', () => {
    const beside = mount(UserAvatar, { props: { name: 'ada' } })
    expect(beside.attributes('aria-hidden')).toBe('true')
    expect(beside.attributes('role')).toBeUndefined()

    const alone = mount(UserAvatar, { props: { name: 'ada', label: 'ada' } })
    expect(alone.attributes('aria-hidden')).toBeUndefined()
    expect(alone.attributes('role')).toBe('img')
    expect(alone.attributes('aria-label')).toBe('ada')
  })
})
