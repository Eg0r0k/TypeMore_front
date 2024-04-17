import { mount } from '@vue/test-utils'
import { Button } from '@/shared/ui/button'
import { expect, it, describe } from 'vitest'

describe('Button', () => {
  it('Renders button text when passed', async () => {
    const wrapper = mount(Button, {
      slots: {
        default: 'Click'
      }
    })
    expect(wrapper.text()).toContain('Click')
  })
  it('Disabled button when loading is true', async () => {
    const wrapper = mount(Button, {
      props: {
        isLoading: true
      }
    })
    expect(wrapper.attributes('disabled')).toBeTruthy()
  })
  it('Disabled button from props', () => {
    const wrapper = mount(Button, {
      props: {
        isDisabled: true
      }
    })
    expect(wrapper.attributes('disabled')).toBeTruthy()
  })
  it('Check no confict with isLoading and isDisabled', () => {
    const wrapper = mount(Button, {
      props: {
        isDisabled: true,
        isLoading: true
      }
    })
    expect(wrapper.attributes('disabled')).toBeTruthy()
  })
  it('Check correct classes based on props', async () => {
    const wrapper = mount(Button, {
      props: {
        color: 'gray',
        size: 's',
        decoration: 'none'
      }
    })
    expect(wrapper.classes()).toContain('button')
    expect(wrapper.classes()).toContain('button--size-s')
    expect(wrapper.classes()).toContain('button--color-gray')
    expect(wrapper.classes()).toContain('decoration--none')
  })
  it('Check empty props', async () => {
    const wrapper = mount(Button, {
      props: {}
    })
    expect(wrapper.classes()).toContain('button')
    expect(wrapper.classes()).toContain('button--size-m')
    expect(wrapper.classes()).toContain('button--color-main')
    expect(wrapper.attributes('disabled')).toBeTruthy()
    expect(wrapper.attributes('role')).toBe('button')
    expect(wrapper.attributes())
    expect(wrapper.attributes('aria-label')).toBe('Button')
  })
})
