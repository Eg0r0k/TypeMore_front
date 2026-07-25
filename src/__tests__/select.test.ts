import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { SelectRoot } from 'reka-ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

const OPTIONS = ['Option 1', 'Option 2', 'Option 3']

// The shadcn Select is composition-based; its content is portaled and opening
// relies on pointer events happy-dom cannot drive, so we assert the reliable
// contract (trigger render, disabled state, v-model forwarding) rather than
// opening the listbox.
const Harness = defineComponent({
  components: { UiSelect: Select, SelectContent, SelectItem, SelectTrigger, SelectValue },
  props: {
    disabled: { type: Boolean, default: false }
  },
  setup() {
    const selected = ref('')
    return { selected, options: OPTIONS }
  },
  template: `
    <UiSelect v-model="selected" :disabled="disabled">
      <SelectTrigger aria-label="Select Label">
        <SelectValue placeholder="Pick one" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="o in options" :key="o" :value="o">{{ o }}</SelectItem>
      </SelectContent>
    </UiSelect>
  `
})

describe('Select Component', () => {
  it('renders a combobox trigger with its label and placeholder', () => {
    const wrapper = mount(Harness)

    const trigger = wrapper.find('button[role="combobox"]')
    expect(trigger.exists()).toBe(true)
    expect(trigger.attributes('aria-label')).toBe('Select Label')
    expect(trigger.text()).toContain('Pick one')

    wrapper.unmount()
  })

  it('forwards v-model when a value is selected', async () => {
    const wrapper = mount(Harness)

    wrapper.findComponent(SelectRoot).vm.$emit('update:modelValue', 'Option 2')
    await nextTick()

    expect(wrapper.vm.selected).toBe('Option 2')

    wrapper.unmount()
  })

  it('disables the trigger when disabled is set', () => {
    const wrapper = mount(Harness, { props: { disabled: true } })

    const trigger = wrapper.find('button[role="combobox"]')
    expect(trigger.attributes('disabled')).toBeDefined()
    expect(trigger.attributes('data-disabled')).toBeDefined()

    wrapper.unmount()
  })
})
