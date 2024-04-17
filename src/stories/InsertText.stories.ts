import { Typography } from '@/shared/ui/typography'
import '@/app/main.scss'
import type { Meta, StoryFn } from '@storybook/vue3'

const meta: Meta = {
  title: 'Insert Text',
  component: Typography,
  argTypes: {
    slotText: { control: 'text' },
    isBold: { control: 'boolean' },
    tagName: { control: 'select', options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span'] },
    size: { control: 'select', options: ['xxxl', 'xxl', 'xl', 'l', 'm', 's', 'xs', 'xxs'] },
    color: { control: 'select', options: ['unset', 'error', 'primary', 'main', 'extraerror'] },
    decoration: { control: 'select', options: ['underline'] }
  },
  tags: ['autodocs']
}

export default meta

export const Default: StoryFn = (args: any) => ({
  components: { Typography },
  setup() {
    return { args }
  },
  template: `
    <Typography v-bind="args">
      {{args.slotText || "The quick brown fox jumps over the lazy dog"}}
    </Typography>
  `
})
