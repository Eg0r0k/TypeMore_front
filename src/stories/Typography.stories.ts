import { Typography } from '@/shared/ui/typography'
import '@/app/main.scss'
import type { Meta, StoryFn } from '@storybook/vue3'
const meta = {
  title: 'Typography',
  component: Typography,
  argTypes: {
    // slotText: { control: 'text' },
    // isBold: { control: 'boolean' },
    // tagName: { control: 'select', options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span'] },
    // size: { control: 'select', options: ['xxxl', 'xxl', 'xl', 'l', 'm', 's', 'xs', 'xxs'] },
    // color: { control: 'select', options: ['none', 'error', 'primary'] }
  },
  tags: ['autodocs']
} satisfies Meta

export default meta

const Template: StoryFn = (args: any) => ({
  components: { Typography },
  setup() {
    return { args }
  },
  template: `
  <Typography v-bind="args">
    {{args.slotText }}
  </Typography>
  `
})
export const LevelAlieses = () => ({
  components: { Typography },
  setup() {
    const args = [
      {
        isBold: false,
        tagName: 'h1',
        size: 'xxxl',
        slotText: 'H1 The quick brown fox jumps over the lazy dog'
      },
      {
        isBold: false,
        tagName: 'h2',
        size: 'xxl',
        slotText: 'H2 The quick brown fox jumps over the lazy dog'
      },
      {
        isBold: false,
        tagName: 'h3',
        size: 'xl',
        slotText: 'H3 The quick brown fox jumps over the lazy dog'
      },
      {
        isBold: false,
        tagName: 'h4',
        size: 'l',
        slotText: 'H4 The quick brown fox jumps over the lazy dog'
      },
      {
        isBold: false,
        tagName: 'h5',
        size: 'm',
        slotText: 'H5 The quick brown fox jumps over the lazy dog'
      },
      {
        isBold: false,
        tagName: 'h6',
        size: 's',
        slotText: 'H6 The quick brown fox jumps over the lazy dog'
      },
      {
        isBold: false,
        tagName: 'p',
        size: 'm',
        slotText: 'P The quick brown fox jumps over the lazy dog'
      }
    ]

    return { args }
  },
  template: `
  <Typography v-for="(arg, index) in args" :key="index" v-bind="arg" >
  {{ arg.slotText }}
  </Typography>
  `
})
