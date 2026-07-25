import type { ComputedRef, InjectionKey, Ref, WritableComputedRef } from 'vue'
import type { ScrollToOptions } from './useScrollable'

export interface ScrollableContext {
  containerRef: Ref<HTMLElement | null>
  thumbRef: Ref<HTMLElement | null>
  scrollPosition: WritableComputedRef<number>
  scrollSize: ComputedRef<number>
  clientSize: ComputedRef<number>
  offsetSize: ComputedRef<number>
  lastScrollDirection: Ref<number>
  loadedAll: Ref<{ top: boolean; bottom: boolean }>
  isScrolledToEnd: ComputedRef<boolean>
  isScrolledToStart: ComputedRef<boolean>
  USE_OWN_SCROLL: boolean
  IS_MOBILE_SAFARI: boolean
  IS_SAFARI: boolean
  thumbSize: Ref<number>
  thumbPosition: Ref<number>
  isDragging: Ref<boolean>
  handleThumbMouseDown: (e: MouseEvent) => void
  scrollTo: (opts: ScrollToOptions) => Promise<void>
  scrollToEnd: (behavior?: ScrollBehavior) => void
  setScrollLocked: (locked: boolean) => void
  scrollToStart: (behavior?: ScrollBehavior) => void
  setScrollPositionSilently: (value: number) => void
  updateThumb: (position?: number) => void
  checkForTriggers: () => void
  onSizeChange: () => void
}

export const scrollableInjectionKey: InjectionKey<ScrollableContext> = Symbol('scrollable')
