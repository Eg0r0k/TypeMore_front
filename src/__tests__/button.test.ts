import { mount } from '@vue/test-utils'
import { Button } from '@/shared/ui/button'
import { expect, it, describe } from 'vitest'

describe('Button', () => {
  it('renders default slot text', () => {
    const wrapper = mount(Button, { slots: { default: 'Click' } })
    expect(wrapper.text()).toContain('Click')
  })

  it('renders a <button> element by default', () => {
    const wrapper = mount(Button)
    expect(wrapper.element.tagName).toBe('BUTTON')
  })

  it('forwards a native disabled attribute to the button', () => {
    const wrapper = mount(Button, { attrs: { disabled: true } })
    expect(wrapper.attributes('disabled')).toBeDefined()
  })

  it('forwards aria-label to the button', () => {
    const wrapper = mount(Button, { attrs: { 'aria-label': 'Save' } })
    expect(wrapper.attributes('aria-label')).toBe('Save')
  })

  it('merges the class prop with variant classes', () => {
    const wrapper = mount(Button, { props: { class: 'extra-class' } })
    expect(wrapper.classes()).toContain('extra-class')
  })

  it('renders as its child element (a link) when as-child is set', () => {
    const wrapper = mount(Button, {
      props: { asChild: true },
      slots: { default: '<a href="/home">Home</a>' }
    })
    const link = wrapper.find('a')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/home')
    expect(link.text()).toContain('Home')
  })
})
