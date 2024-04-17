import type { Meta, StoryFn } from '@storybook/vue3'
import { Button } from '@/shared/ui/button'
import '@/app/main.scss'

const meta = {
  title: 'Button',
  component: Button,
  argTypes: {
    buttonLabel: { control: 'text' },
    color: { control: 'select', options: ['primary', 'gray', 'main'] },
    size: { control: 'select', options: ['m', 's', 'l'] },
    decoration: { control: 'select', options: ['default', 'none'] },
    isDisabled: { control: 'boolean' },
    isLoading: { control: 'boolean' },
    slotText: { control: 'text' }
  },
  tags: ['autodocs']
} satisfies Meta

export default meta

const Template: StoryFn = (args: any) => ({
  components: { Button },
  setup() {
    return { args }
  },
  template: `
    <Button v-bind="args" id="one">
      {{ args.slotText }}
    </Button>
  `
})

export const Default = Template.bind({})
Default.args = {
  color: 'primary',
  size: 'm',
  decoration: 'default',
  isDisabled: false,
  isLoading: false,
  slotText: 'Button Text'
}
Default.parameters = {
  pseudo: {}
}
