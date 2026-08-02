import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as InputGroup } from './InputGroup.vue'
export { default as InputGroupAddon } from './InputGroupAddon.vue'
export { default as InputGroupButton } from './InputGroupButton.vue'
export { default as InputGroupInput } from './InputGroupInput.vue'

/**
 * Which end of the field the addon sits at. `order-first` / `order-last` rather
 * than markup order, so a template can declare the addon wherever it reads best.
 */
export const inputGroupAddonVariants = cva(
  'text-sub flex h-auto cursor-text select-none items-center justify-center gap-1.5 text-sm [&>svg:not([class*=size-])]:size-4',
  {
    variants: {
      align: {
        'inline-start': 'order-first pl-1.5',
        'inline-end': 'order-last pr-1.5'
      }
    },
    defaultVariants: { align: 'inline-start' }
  }
)

export type InputGroupVariants = VariantProps<typeof inputGroupAddonVariants>
export type InputGroupAlign = NonNullable<InputGroupVariants['align']>
