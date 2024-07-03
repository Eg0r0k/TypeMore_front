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

  it('Check no conflict with isLoading and isDisabled', () => {
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
    expect(wrapper.attributes('disabled')).toBe('false')
    expect(wrapper.attributes('role')).toBe('button')
    expect(wrapper.attributes('aria-label')).toBe('Button')
  })

  it('Renders left icon slot', () => {
    const wrapper = mount(Button, {
      slots: {
        'left-icon': '<span class="left-icon">Left</span>'
      }
    })
    expect(wrapper.find('.left-icon').exists()).toBe(true)
  })

  it('Renders right icon slot', () => {
    const wrapper = mount(Button, {
      slots: {
        'right-icon': '<span class="right-icon">Right</span>'
      }
    })
    expect(wrapper.find('.right-icon').exists()).toBe(true)
  })

  it('Check aria attributes', async () => {
    const wrapper = mount(Button, {
      props: {
        isLoading: true,
        buttonLabel: 'Submit'
      }
    })
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.attributes('aria-label')).toBe('Submit')
  })

  it('Loading state hides text and shows loader', () => {
    const wrapper = mount(Button, {
      props: {
        isLoading: true
      }
    })
    expect(wrapper.find('.loader').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Button Text')
  })
})
