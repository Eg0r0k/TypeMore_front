import { mount } from '@vue/test-utils'
import { describe, it, vi, expect } from 'vitest'
import { TextInput } from '@/shared/ui/input'

vi.mock('@/shared/ui/typography', () => ({
  Typography: {
    name: 'Typography',
    template: '<div><slot></slot></div>'
  }
}))

describe('Input', () => {
  it('renders input by default', () => {
    const wrapper = mount(TextInput)
    expect(wrapper.find('input').exists()).to.equal(true)
  })
  it('renders textarea when tagName prop is textarea', () => {
    const wrapper = mount(TextInput, {
      props: { tagName: 'textarea' }
    })
    expect(wrapper.find('textarea').exists()).to.equal(true)
  })

  it('updates modelValue on input', async () => {
    const wrapper = mount(TextInput, {
      props: { modelValue: '' }
    })
    await wrapper.find('input').setValue('test')
    expect(wrapper.emitted('update:modelValue')?.[0]).to.deep.equal(['test'])
  })
  it('displays error message when errorMessage and hasErrorSpace are set', () => {
    const errorMessage = 'This is an error'
    const wrapper = mount(TextInput, {
      props: { errorMessage, hasErrorSpace: true }
    })
    expect(wrapper.text()).to.include(errorMessage)
  })
  it('does not render error message when hasErrorSpace is false', () => {
    const errorMessage = 'This is an error'
    const wrapper = mount(TextInput, {
      props: { errorMessage, hasErrorSpace: false }
    })
    expect(wrapper.text()).to.not.include(errorMessage)
  })
  it('disables input when isDisabled prop is true', () => {
    const wrapper = mount(TextInput, {
      props: { isDisabled: true }
    })
    expect(wrapper.find('input').element.disabled).to.equal(true)
  })
  it('emits blur event when input is blurred', async () => {
    const wrapper = mount(TextInput)
    await wrapper.find('input').trigger('blur')
    expect(wrapper.emitted('blur')).to.have.length(1)
  })
  it('renders label slot content', () => {
    const wrapper = mount(TextInput, {
      slots: {
        default: 'Label Text'
      }
    })
    expect(wrapper.find('label').text()).to.equal('Label Text')
  })
  it('passes attributes to input element', () => {
    const wrapper = mount(TextInput, {
      attrs: {
        id: 'test-id',
        'data-test': 'test-input'
      }
    })
    const input = wrapper.find('input')
    expect(input.attributes('id')).to.equal('test-id')
    expect(input.attributes('data-test')).to.equal('test-input')
  })
})
