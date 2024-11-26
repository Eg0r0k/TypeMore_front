import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { Select } from '@/shared/ui/select'
interface SelectComponentSetup {
  labelId: string
  selectedIndex: number
}
describe('Select Component', () => {
  let wrapper: any

  beforeEach(() => {
    wrapper = mount(Select, {
      props: {
        options: ['Option 1', 'Option 2', 'Option 3'],
        label: 'Select Label'
      }
    })
  })

  afterEach(() => {
    wrapper.unmount()
  })

  it('renders the component correctly', () => {
    expect(wrapper.find('.custom-select').exists()).toBe(true)
    expect(wrapper.find('.selected').text()).toBe('Option 1')
    expect(wrapper.find('.items').classes()).toContain('selectHide')
  })

  it('emits the correct input event on option selection', async () => {
    await wrapper.find('.selected').trigger('click')
    await wrapper.findAll('.items > div')[1].trigger('click')
    expect(wrapper.emitted('input')[0]).toEqual(['Option 2'])
    expect(wrapper.find('.selected').text()).toBe('Option 2')
  })

  it('toggles the dropdown on click', async () => {
    await wrapper.find('.selected').trigger('click')
    expect(wrapper.find('.items').classes()).not.toContain('selectHide')
    await wrapper.find('.selected').trigger('click')
    expect(wrapper.find('.items').classes()).toContain('selectHide')
  })
  it('closes the dropdown on blur', async () => {
    await wrapper.find('.selected').trigger('click')
    await wrapper.find('.custom-select').trigger('blur')
    expect(wrapper.find('.items').classes()).toContain('selectHide')
  })

  it('handles disabled state', async () => {
    const disabledWrapper = mount(Select, {
      props: {
        options: ['Option 1', 'Option 2', 'Option 3'],
        label: 'Select Label',
        disabled: true
      }
    })
    expect(disabledWrapper.find('.selected').classes()).toContain('disabled')
    expect(disabledWrapper.findAll('.items > div')[0].classes()).toContain('disabled')

    await disabledWrapper.find('.selected').trigger('click')
    expect(disabledWrapper.find('.items').classes()).toContain('selectHide')

    await disabledWrapper.findAll('.items > div')[1].trigger('click')
    expect(disabledWrapper.emitted('input')).toBeUndefined()
  })

  it('sets default value correctly', () => {
    const defaultWrapper = mount(Select, {
      props: {
        options: ['Option 1', 'Option 2', 'Option 3'],
        label: 'Select Label',
        default: 'Option 2'
      }
    })
    expect(defaultWrapper.find('.selected').text()).toBe('Option 2')
  })

  it('handles null options', () => {
    const nullOptionsWrapper = mount(Select, {
      props: {
        options: [],
        label: 'Select Label'
      }
    })
    expect(nullOptionsWrapper.find('.selected').text()).toBe('')
  })

  it('uses the first option if default is not provided and options exist', () => {
    const noDefaultWrapper = mount(Select, {
      props: {
        options: ['Option 1', 'Option 2', 'Option 3'],
        label: 'Select Label'
      }
    })
    expect(noDefaultWrapper.find('.selected').text()).toBe('Option 1')
  })

  it('sets selectedIndex correctly after selecting an option', async () => {
    await wrapper.find('.selected').trigger('click')
    await wrapper.findAll('.items > div')[1].trigger('click')

    const wrapperVm = wrapper.vm as unknown as SelectComponentSetup
    expect(wrapperVm.selectedIndex).toBe(1)
  })
  it('handles Escape key correctly', async () => {
    await wrapper.find('.selected').trigger('click')
    await wrapper.find('.custom-select').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('.items').classes()).toContain('selectHide')
  })

  it('should generate a unique labelId', () => {
    const wrapper1 = mount(Select, { props: { options: ['A'], label: 'Label' } })
    const wrapper2 = mount(Select, { props: { options: ['A'], label: 'Label' } })

    const wrapper1Vm = wrapper1.vm as unknown as SelectComponentSetup
    const wrapper2Vm = wrapper2.vm as unknown as SelectComponentSetup

    expect(wrapper1Vm.labelId).not.toBe(wrapper2Vm.labelId)
  })

  it('should render the label correctly', () => {
    const label = 'Test Label'
    const wrapper = mount(Select, { props: { options: ['A'], label } })
    const labelElement = wrapper.find('label')
    expect(labelElement.text()).toBe(label)
  })

  it('should set aria-labelledby correctly', () => {
    const wrapper = mount(Select, { props: { options: ['A'], label: 'Label' } })
    const wrapper1Vm = wrapper.vm as unknown as SelectComponentSetup
    const selectElement = wrapper.find('.custom-select')
    expect(selectElement.attributes('aria-labelledby')).toBe(wrapper1Vm.labelId)
  })

  it('should set aria-expanded correctly', async () => {
    const selectElement = wrapper.find('.custom-select')
    expect(selectElement.attributes('aria-expanded')).toBe('false')
    await wrapper.find('.selected').trigger('click')
    expect(selectElement.attributes('aria-expanded')).toBe('true')
  })

  it('should set aria-disabled correctly', () => {
    const disabledWrapper = mount(Select, {
      props: {
        options: ['Option 1'],
        label: 'Select Label',
        disabled: true
      }
    })
    const selectElement = disabledWrapper.find('.custom-select')
    expect(selectElement.attributes('aria-disabled')).toBe('true')
  })

  it('should set aria-haspopup and role correctly for the selected element', () => {
    const selectedElement = wrapper.find('.selected')
    expect(selectedElement.attributes('aria-haspopup')).toBe('listbox')
    expect(selectedElement.attributes('role')).toBe('button')
  })

  it('should set role and aria-selected correctly for the options', async () => {
    await wrapper.find('.selected').trigger('click')
    await wrapper.findAll('.items > div')[2].trigger('click')
    await nextTick()

    await wrapper.find('.selected').trigger('click')

    const options = wrapper.findAll('.items > div')
    const wrapperVm = wrapper.vm as unknown as SelectComponentSetup

    for (let i = 0; i < options.length; i++) {
      const option = options[i]
      expect(option.attributes('role')).toBe('option')
      expect(option.attributes('aria-selected')).toBe(
        wrapperVm.selectedIndex === i ? 'true' : 'false'
      )
    }
  })
  it('should set tabindex correctly', () => {
    const tabindex = 3
    const wrapper = mount(Select, {
      props: {
        options: ['A'],
        label: 'Label',
        tabindex
      }
    })
    const selectElement = wrapper.find('.custom-select')
    expect(selectElement.attributes('tabindex')).toBe(String(tabindex))
  })
})
