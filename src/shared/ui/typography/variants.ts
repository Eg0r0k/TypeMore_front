import { cva, type VariantProps } from 'class-variance-authority'

/**
 * Typography on the Tailwind token layer.
 *
 * The component used to carry a PRIVATE `--typography-size-*` scale
 * (49/39/31/25/20/16/13/10px) and paint colours straight from
 * `var(--sub-color)`. Both were invisible to the rest of the app: every shadcn
 * surface in `shared/ui` is written in Tailwind utilities, so `size="xs"`
 * (13px) and a neighbouring `text-sm` (14px) disagreed by a pixel with no way
 * to see it from either side.
 *
 * Sizes now map onto Tailwind's own scale and colours onto the bridge tokens
 * declared in `app/tailwind.css` (`--color-sub` -> `text-sub`, ...), which
 * themselves alias the palette in `app/main.scss`. One scale, one palette, and
 * `text-*` means the same thing whether it comes from this component or from a
 * hand-written class.
 *
 * Note that Tailwind's `text-*` steps carry a paired line-height — adopting the
 * scale adopts its leading too, which is the point of using the token rather
 * than a bare font-size.
 */
export const typographyVariants = cva('mt-0 cursor-default not-italic', {
  variants: {
    size: {
      xxs: 'text-xs',
      xs: 'text-sm',
      s: 'text-base',
      m: 'text-xl',
      l: 'text-2xl',
      xl: 'text-3xl',
      xxl: 'text-4xl',
      xxxl: 'text-5xl'
    },
    color: {
      // `unset` inherits, so it deliberately contributes no class.
      unset: '',
      primary: 'text-text',
      sub: 'text-sub',
      main: 'text-main',
      error: 'text-error',
      'extra-error': 'text-error-extra'
    },
    decoration: {
      underline: 'underline'
    },
    isBold: {
      true: 'font-bold',
      false: ''
    }
  },
  defaultVariants: {
    size: 's',
    color: 'unset',
    isBold: false
  }
})

export type TypographyVariants = VariantProps<typeof typographyVariants>
