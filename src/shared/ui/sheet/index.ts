import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export {
  Dialog as Sheet,
  DialogClose as SheetClose,
  DialogDescription as SheetDescription,
  DialogTitle as SheetTitle
} from '@/shared/ui/dialog'
export { default as SheetContent } from './SheetContent.vue'

/**
 * The edge the panel is anchored to. `bottom` is the phone tray; the others are
 * here because the variant is what makes this a sheet rather than one hard-coded
 * panel, and adding a side later should not mean rewriting the component.
 */
export const sheetVariants = cva(
  'bg-sub-alt text-text fixed z-[var(--modal-z)] flex flex-col gap-3 shadow-lg outline-none will-change-transform data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300 motion-reduce:transition-none',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 rounded-b-md border-b border-sub p-4 data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
        bottom:
          'inset-x-0 bottom-0 rounded-t-md border-t border-sub p-4 pb-[max(1rem,env(safe-area-inset-bottom))] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        left: 'inset-y-0 left-0 h-full w-3/4 max-w-sm border-r border-sub p-4 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
        right:
          'inset-y-0 right-0 h-full w-3/4 max-w-sm border-l border-sub p-4 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right'
      }
    },
    defaultVariants: { side: 'bottom' }
  }
)

export type SheetVariants = VariantProps<typeof sheetVariants>
export type SheetSide = NonNullable<SheetVariants['side']>
