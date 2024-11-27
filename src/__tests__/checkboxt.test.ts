import { mount } from '@vue/test-utils'
import { CheckBox } from '@/shared/ui/checkbox'
import { describe, it, expect } from 'vitest'
import { assert } from 'chai'

describe('Checkbox', () => {
  it('renders checkbox label when passed', () => {
    const label = 'Test Label'
    const wrapper = mount(CheckBox, {
      props: { value: 'test', label },
      modelValue: false
    })
    expect(wrapper.text()).to.include(label)
  })

  it('emits input event when value changes', async () => {
    const wrapper = mount(CheckBox, {
      props: { value: 'test' },
      modelValue: false
    })
    const input = wrapper.find('input')
    await input.setValue(true)
    expect(wrapper.emitted('input')).to.have.lengthOf.above(0)
    expect(wrapper.emitted('input')![0]).to.have.lengthOf(1)
  })

  it('emits change event when value changes', async () => {
    const wrapper = mount(CheckBox, {
      props: { value: 'test' },
      modelValue: false
    })
    const input = wrapper.find('input')
    await input.setValue(true)
    expect(wrapper.emitted('change')).to.have.lengthOf.above(0)
    expect(wrapper.emitted('change')![0]).to.have.lengthOf(1)
  })

  it('is disabled when isDisabled prop is true', () => {
    const wrapper = mount(CheckBox, {
      props: { value: 'test', isDisabled: true },
      modelValue: false
    })
    const input = wrapper.find('input')
    assert.isDefined(input.attributes('disabled'))
  })

  it('has correct default props', () => {
    const wrapper = mount(CheckBox, {
      props: { value: 'test' },
      modelValue: false
    })
    const input = wrapper.find('input')
    expect(input.attributes('name')).to.equal('checkbox')
    expect(wrapper.text()).to.have.lengthOf(0)
  })

  it('v-model works correctly', async () => {
    const wrapper = mount(CheckBox, {
      props: { value: 'test' },
      modelValue: false
    })
    const input = wrapper.find('input')
    await input.setValue(true)
    expect(wrapper.emitted('update:modelValue')).to.have.lengthOf.above(0)
    expect(wrapper.emitted('update:modelValue')![0]).to.deep.equal([true])
  })
})
