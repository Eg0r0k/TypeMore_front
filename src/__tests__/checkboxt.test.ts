import { mount } from '@vue/test-utils'
import { CheckBox } from '@/shared/ui/checkbox'
import { describe, it, expect, assert } from 'vitest'

describe('Checkbox', () => {
  it('renders checkbox label when passed', () => {
    const label = 'Test Label'
    const wrapper = mount(CheckBox, {
      props: { value: 'test', label, modelValue: false }
    })
    expect(wrapper.text()).to.include(label)
  })

  it('renders default slot content', () => {
    const wrapper = mount(CheckBox, {
      props: { value: 'test', modelValue: false },
      slots: { default: 'Slotted' }
    })
    expect(wrapper.text()).to.include('Slotted')
  })

  it('emits update:modelValue when the checkbox is clicked', async () => {
    const wrapper = mount(CheckBox, {
      props: { value: 'test', modelValue: false }
    })
    await wrapper.find('[role=checkbox]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).to.have.lengthOf.above(0)
    expect(wrapper.emitted('update:modelValue')![0]).to.deep.equal([true])
  })

  it('does not emit legacy input/change events', async () => {
    const wrapper = mount(CheckBox, {
      props: { value: 'test', modelValue: false }
    })
    await wrapper.find('[role=checkbox]').trigger('click')
    expect(wrapper.emitted('input')).to.equal(undefined)
    expect(wrapper.emitted('change')).to.equal(undefined)
  })

  it('is disabled when isDisabled prop is true', () => {
    const wrapper = mount(CheckBox, {
      props: { value: 'test', isDisabled: true, modelValue: false }
    })
    const toggle = wrapper.find('[role=checkbox]')
    assert.isDefined(toggle.attributes('disabled'))
  })

  it('has correct default name prop', () => {
    const wrapper = mount(CheckBox, {
      props: { value: 'test', modelValue: false }
    })
    const input = wrapper.find('input')
    expect(input.attributes('name')).to.equal('checkbox')
  })

  it('renders no label text by default', () => {
    const wrapper = mount(CheckBox, {
      props: { value: 'test', modelValue: false }
    })
    expect(wrapper.text()).to.have.lengthOf(0)
  })

  it('v-model toggles the bound value', async () => {
    const wrapper = mount(CheckBox, {
      props: { value: 'test', modelValue: false }
    })
    await wrapper.find('[role=checkbox]').trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).to.deep.equal([true])

    await wrapper.setProps({ modelValue: true })
    await wrapper.find('[role=checkbox]').trigger('click')
    expect(wrapper.emitted('update:modelValue')![1]).to.deep.equal([false])
  })

  it('renders indeterminate state when indeterminate prop is true', () => {
    const wrapper = mount(CheckBox, {
      props: { value: 'test', indeterminate: true, modelValue: false }
    })
    const toggle = wrapper.find('[role=checkbox]')
    expect(toggle.attributes('aria-checked')).to.equal('mixed')
    expect(toggle.attributes('data-state')).to.equal('indeterminate')
  })
})
