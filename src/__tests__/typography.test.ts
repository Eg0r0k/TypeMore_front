import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import { Typography, type TypographyVariants } from '@/shared/ui/typography'
describe('Typography', () => {
  it('renders default paragraph element', () => {
    const wrapper = mount(Typography)
    expect(wrapper.find('p').exists()).to.equal(true)
  })
  it('renders correct tag based on tagName prop', () => {
    const tags: Array<'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'a'> = [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'span',
      'a'
    ]
    tags.forEach((tag) => {
      const wrapper = mount(Typography, {
        props: { tagName: tag }
      })
      expect(wrapper.find(tag).exists()).to.equal(true)
    })
  })
  // The size/colour props resolve to TAILWIND tokens, not to a private
  // `--typography-size-*` scale — that is the whole point of the token bridge in
  // `app/tailwind.css`, so the mapping is what these tests pin.
  it('maps every size onto its Tailwind step', () => {
    const sizes: Record<NonNullable<TypographyVariants['size']>, string> = {
      xxs: 'text-xs',
      xs: 'text-sm',
      s: 'text-base',
      m: 'text-xl',
      l: 'text-2xl',
      xl: 'text-3xl',
      xxl: 'text-4xl',
      xxxl: 'text-5xl'
    }
    for (const [size, expected] of Object.entries(sizes)) {
      const wrapper = mount(Typography, {
        props: { size: size as NonNullable<TypographyVariants['size']> }
      })
      expect(wrapper.classes(), size).to.include(expected)
    }
  })
  it('maps every colour onto its palette token', () => {
    const colors: Record<NonNullable<TypographyVariants['color']>, string | null> = {
      unset: null,
      primary: 'text-text',
      sub: 'text-sub',
      main: 'text-main',
      error: 'text-error',
      'extra-error': 'text-error-extra'
    }
    for (const [color, expected] of Object.entries(colors)) {
      const wrapper = mount(Typography, {
        props: { color: color as NonNullable<TypographyVariants['color']> }
      })
      // `unset` inherits: it must add no colour token at all (the size token,
      // which shares the `text-` prefix, still has to be there).
      if (expected === null) {
        const painted = ['text-text', 'text-sub', 'text-main', 'text-error', 'text-error-extra']
        expect(wrapper.classes().filter((c) => painted.includes(c))).to.deep.equal([])
      } else {
        expect(wrapper.classes(), color).to.include(expected)
      }
    }
  })
  it('applies bold class when isBold prop is true', () => {
    const wrapper = mount(Typography, {
      props: { isBold: true }
    })
    expect(wrapper.classes()).to.include('font-bold')
  })
  it('applies underline decoration class', () => {
    const wrapper = mount(Typography, {
      props: { decoration: 'underline' }
    })
    expect(wrapper.classes()).to.include('underline')
  })
  // tailwind-merge, not concatenation: the caller's size must beat the variant's.
  it('lets a caller class override the size token', () => {
    const wrapper = mount(Typography, {
      props: { size: 'xxxl', class: 'text-sm' }
    })
    expect(wrapper.classes()).to.include('text-sm')
    expect(wrapper.classes()).to.not.include('text-5xl')
  })
  it('renders slot content', () => {
    const wrapper = mount(Typography, {
      slots: {
        default: 'Test content'
      }
    })
    expect(wrapper.text()).to.equal('Test content')
  })

  it('adds href attribute for anchor tags', () => {
    const href = 'https://example.com'
    const wrapper = mount(Typography, {
      props: { tagName: 'a', href }
    })
    expect(wrapper.attributes('href')).to.equal(href)
  })
  it('does not add href attribute for non-anchor tags', () => {
    const href = 'https://example.com'
    const wrapper = mount(Typography, {
      props: { tagName: 'p', href }
    })
    expect(wrapper.attributes()).to.not.have.property('href')
  })
  it('combines multiple classes correctly', () => {
    const wrapper = mount(Typography, {
      props: {
        tagName: 'h1',
        size: 'xl',
        color: 'primary',
        isBold: true,
        decoration: 'underline'
      }
    })
    const classes = wrapper.classes()
    expect(classes).to.include('text-text')
    expect(classes).to.include('text-3xl')
    expect(classes).to.include('underline')
    expect(classes).to.include('font-bold')
    expect(wrapper.element.tagName).to.equal('H1')
  })
})
