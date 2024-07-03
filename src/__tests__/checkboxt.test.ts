import { mount } from '@vue/test-utils'
import { CheckBox } from '@/shared/ui/checkbox'
import { describe, it } from 'vitest'
import { expect } from 'chai'

describe('Checkbox', () => {
  it('renders checkbox label when passed', () => {
    const label = 'Test Label'
    const wrapper = mount(CheckBox, {
      props: { value: false, label }
    })
    expect(wrapper.text()).to.include(label)
  })

  it('emits input event when value changes', async () => {
    const wrapper = mount(CheckBox, {
      props: { value: false }
    })
    const input = wrapper.find('input')
    await input.setValue(true)
    expect(wrapper.emitted('input')).to.not.be.undefined
    expect(wrapper.emitted('input')![0]).to.have.lengthOf(1)
  })

  it('emits change event when value changes', async () => {
    const wrapper = mount(CheckBox, {
      props: { value: false }
    })
    const input = wrapper.find('input')
    await input.setValue(true)
    expect(wrapper.emitted('change')).to.not.be.undefined
    expect(wrapper.emitted('change')![0]).to.have.lengthOf(1)
  })

  it('is disabled when isDisabled prop is true', () => {
    const wrapper = mount(CheckBox, {
      props: { value: false, isDisabled: true }
    })
    const input = wrapper.find('input')
    expect(input.attributes('disabled')).to.not.be.undefined
  })

  it('has correct default props', () => {
    const wrapper = mount(CheckBox)
    const input = wrapper.find('input')
    expect(input.attributes('name')).to.equal('checkbox')
    expect(wrapper.text()).to.be.empty
  })

  it('v-model works correctly', async () => {
    const wrapper = mount(CheckBox, {
      props: { value: false }
    })
    const input = wrapper.find('input')
    await input.setValue(true)
    expect(wrapper.emitted('update:modelValue')).to.not.be.undefined
    expect(wrapper.emitted('update:modelValue')![0]).to.deep.equal([true])
  })
})
