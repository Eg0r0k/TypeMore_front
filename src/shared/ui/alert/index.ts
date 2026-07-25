import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Alert } from './ui.vue'

export const alertVariants = cva(
  'flex w-full min-w-[320px] max-w-[400px] flex-row justify-between gap-2 rounded-md border border-sub border-l-4 bg-sub-alt py-3 pr-2 pl-4 font-mono text-text transition-tm',
  {
    variants: {
      type: {
        error: 'border-l-error',
        warn: 'border-l-error',
        success: 'border-l-main',
        info: 'border-l-sub'
      }
    },
    defaultVariants: {
      type: 'info'
    }
  }
)
export type AlertVariants = VariantProps<typeof alertVariants>

export const alertIconVariants = cva('', {
  variants: {
    type: {
      error: 'text-error',
      warn: 'text-error',
      success: 'text-main',
      info: 'text-sub'
    }
  },
  defaultVariants: {
    type: 'info'
  }
})
