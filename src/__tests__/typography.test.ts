import { mount } from '@vue/test-utils'
import { describe, it } from 'vitest'
import { Typography } from '@/shared/ui/typography'
import { expect } from 'chai'
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
  it('applies correct class size', () => {
    const sizes: Array<'xxxl' | 'xxl' | 'xl' | 'l' | 'm' | 's' | 'xs' | 'xxs'> = [
      'l',
      'm',
      's',
      'xl',
      'xs',
      'xxl',
      'xxs',
      'xxxl'
    ]
    sizes.forEach((size) => {
      const wrapper = mount(Typography, {
        props: {
          size: size
        }
      })
      expect(wrapper.classes()).to.include(`typography--size-${size}`)
    })
  })
  it('applies correct color class', () => {
    const colors: Array<'unset' | 'primary' | 'error' | 'main' | 'extra-error' | 'sub'> = [
      'unset',
      'primary',
      'error',
      'main',
      'extra-error',
      'sub'
    ]
    colors.forEach((color) => {
      const wrapper = mount(Typography, {
        props: { color }
      })
      expect(wrapper.classes()).to.include(`typography--color-${color}`)
    })
  })
  it('applies bold class when isBold prop is true', () => {
    const wrapper = mount(Typography, {
      props: { isBold: true }
    })
    expect(wrapper.classes()).to.include('bold')
  })
  it('applies underline decoration class', () => {
    const wrapper = mount(Typography, {
      props: { decoration: 'underline' }
    })
    expect(wrapper.classes()).to.include('typography--decoration-underline')
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
    expect(classes).to.include('typography')
    expect(classes).to.include('typography--color-primary')
    expect(classes).to.include('typography--size-xl')
    expect(classes).to.include('typography--decoration-underline')
    expect(classes).to.include('bold')
    expect(classes).to.include('tag--h1')
  })
})
