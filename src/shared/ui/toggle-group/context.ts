import type { InjectionKey } from 'vue'
import type { VariantProps } from 'class-variance-authority'
import type { toggleVariants } from '@/shared/ui/toggle'

type ToggleVariants = VariantProps<typeof toggleVariants>

export interface ToggleGroupContext {
  variant: ToggleVariants['variant']
  size: ToggleVariants['size']
  spacing: number
}

export const TOGGLE_GROUP_KEY: InjectionKey<ToggleGroupContext> = Symbol('toggleGroup')
