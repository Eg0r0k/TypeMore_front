import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Button } from './Button.vue'

export const buttonVariants = cva(
  "cursor-pointer select-none inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      color: {
        main: 'bg-main text-bg hover:bg-text hover:text-bg active:brightness-[0.85]',
        gray: 'bg-sub-alt text-sub hover:text-text active:bg-sub',
        error: 'bg-error text-text hover:bg-error-extra active:brightness-[0.8]',
        shadow: 'bg-transparent text-sub hover:text-text active:bg-sub-alt',
        'main-outline':
          'bg-transparent text-main border border-main hover:bg-main hover:text-bg active:brightness-[0.85]',
        'error-outline':
          'bg-transparent text-error border border-error hover:bg-error hover:text-text active:brightness-[0.8]'
      },
      size: {
        s: 'gap-1 px-2 py-1 text-xs has-[>svg]:px-2.5',
        m: 'px-4 py-2 text-sm has-[>svg]:px-4',
        l: 'px-6 py-3  has-[>svg]:px-4',
        icon: 'size-9',
        'icon-xs': 'size-5',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10'
      }
    },
    defaultVariants: {
      color: 'main',
      size: 'm'
    }
  }
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
export type ButtonColor = NonNullable<ButtonVariants['color']>
export type ButtonSize = NonNullable<ButtonVariants['size']>
