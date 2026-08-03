<template>
  <div ref="wrapperRef" :class="wrapperClasses">
    <div
      v-if="scrollable.USE_OWN_SCROLL && showThumbVisible"
      class="scrollable-thumb-container scrollable-thumb-container-y"
    >
      <div
        ref="thumbRef"
        class="scrollable-thumb"
        :class="{ 'is-focused': scrollable.isDragging.value }"
        :style="thumbStyle"
        @mousedown="scrollable.handleThumbMouseDown"
      />
    </div>

    <div ref="containerRef" :class="containerClasses" @scroll="handleScroll">
      <div ref="beforeRef">
        <slot name="before" />
      </div>

      <div v-if="$slots.sticky" ref="stickyRef" class="virtual-scrollable-sticky">
        <slot name="sticky" />
      </div>

      <div
        v-if="items.length > 0"
        :style="{
          height: `${totalSize}px`,
          width: '100%',
          position: 'relative'
        }"
      >
        <div
          v-for="virtualRow in virtualizer.getVirtualItems()"
          :key="String(virtualRow.key)"
          :ref="(el) => measureElement(el as Element | null)"
          :data-index="virtualRow.index"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualRow.start - preListHeight + effectivePaddingTop}px)`
          }"
        >
          <slot
            :item="items[virtualRow.index]"
            :index="virtualRow.index"
            :virtual-row="virtualRow"
          />
        </div>
      </div>

      <div v-if="loading">
        <slot name="loader" />
      </div>

      <div v-if="!loading && items.length === 0">
        <slot name="empty" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
  import { useVirtualizer } from '@tanstack/vue-virtual'
  import {
    computed,
    nextTick,
    onMounted,
    onUnmounted,
    provide,
    ref,
    useTemplateRef,
    watch
  } from 'vue'
  import { scrollableInjectionKey, useScrollable } from '@/shared/ui/scrollable'
  import '@/shared/ui/scrollable/scrollable.scss'

  interface Props {
    items: T[]
    estimateSize?: number
    itemHeight?: number
    getItemKey?: (index: number) => string | number
    loading?: boolean
    paddingTop?: number
    paddingBottom?: number
  }

  const props = withDefaults(defineProps<Props>(), {
    estimateSize: 64,
    itemHeight: undefined,
    getItemKey: (index: number) => index,
    loading: false,
    paddingTop: 0,
    paddingBottom: 0
  })

  const emit = defineEmits<{
    scroll: [event: Event]
  }>()

  const beforeHeight = ref(0)
  const stickyHeight = ref(0)
  const preListHeight = computed(() => beforeHeight.value + stickyHeight.value)

  const effectivePaddingTop = computed(() => (props.items.length > 0 ? props.paddingTop : 0))

  const effectivePaddingBottom = computed(() => (props.items.length > 0 ? props.paddingBottom : 0))

  const totalSize = computed(() => {
    if (props.items.length === 0) {
      return 0
    }
    return (
      virtualizer.value.getTotalSize() + effectivePaddingTop.value + effectivePaddingBottom.value
    )
  })

  const containerRef = useTemplateRef('containerRef')
  const beforeRef = useTemplateRef('beforeRef')
  const stickyRef = useTemplateRef('stickyRef')

  let beforeResizeObserver: ResizeObserver | null = null
  let stickyResizeObserver: ResizeObserver | null = null
  let scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null

  function updateBeforeHeight() {
    const newHeight = beforeRef.value?.getBoundingClientRect().height ?? 0
    if (beforeHeight.value !== newHeight) {
      beforeHeight.value = newHeight
      virtualizer.value.measure()
      scrollable.updateThumb()
    }
  }

  function updateStickyHeight() {
    const newHeight = stickyRef.value?.getBoundingClientRect().height ?? 0
    if (stickyHeight.value !== newHeight) {
      stickyHeight.value = newHeight
      virtualizer.value.measure()
      scrollable.updateThumb()
    }
  }

  const scrollable = useScrollable(containerRef, { direction: 'vertical' })

  const virtualizer = useVirtualizer(
    computed(() => ({
      count: props.items.length,
      getScrollElement: () => containerRef.value,
      estimateSize: () => props.itemHeight ?? props.estimateSize,
      overscan: 5,
      getItemKey: (index: number) => props.getItemKey(index),
      scrollMargin: preListHeight.value
    }))
  )

  const measureElement = (el: Element | null) => {
    if (el && !props.itemHeight) {
      virtualizer.value.measureElement(el)
    }
  }

  const handleScroll = (e: Event) => {
    if (scrollDebounceTimer) {
      clearTimeout(scrollDebounceTimer)
    }
    scrollDebounceTimer = setTimeout(() => {
      scrollable.updateThumb()
    }, 16)

    emit('scroll', e)
  }

  const wrapperClasses = ['scrollable-wrapper', 'scrollable-direction-y']

  const containerClasses = computed(() => [
    'scrollable',
    'scrollable-y',
    {
      'no-scrollbar': scrollable.USE_OWN_SCROLL,
      'no-scrollbar-safari': scrollable.IS_SAFARI && !scrollable.IS_MOBILE_SAFARI
    }
  ])

  const showThumbVisible = computed(() => scrollable.thumbSize.value > 0)

  const thumbStyle = computed(() => ({
    height: `${scrollable.thumbSize.value}px`,
    transform: `translateY(${scrollable.thumbPosition.value}px)`
  }))

  provide(scrollableInjectionKey, scrollable)

  interface ScrollToIndexOptions {
    align?: 'start' | 'center' | 'end' | 'auto'
    behavior?: 'auto' | 'smooth'
  }

  const scrollToIndex = (index: number, options?: ScrollToIndexOptions) => {
    if (index >= 0 && index < props.items.length) {
      virtualizer.value.scrollToIndex(index, options)
    }
  }

  const scrollToOffset = (offset: number, options?: { behavior?: 'auto' | 'smooth' }) => {
    virtualizer.value.scrollToOffset(offset, options)
  }

  watch(
    () => props.items.length,
    () => {
      nextTick(() => {
        virtualizer.value.measure()
        scrollable.updateThumb()
      })
    }
  )

  watch(
    () => [props.itemHeight, props.estimateSize] as const,
    () => {
      nextTick(() => {
        virtualizer.value.measure()
        scrollable.updateThumb()
      })
    }
  )

  watch(
    () => [props.paddingTop, props.paddingBottom] as const,
    () => {
      if (props.items.length > 0) {
        nextTick(() => {
          virtualizer.value.measure()
          scrollable.updateThumb()
        })
      }
    }
  )

  watch(
    () => props.items,
    () => {
      nextTick(() => {
        virtualizer.value.measure()
        scrollable.updateThumb()
      })
    },
    { deep: false }
  )

  onMounted(() => {
    nextTick(() => {
      updateBeforeHeight()
      updateStickyHeight()

      if (beforeRef.value && typeof ResizeObserver !== 'undefined') {
        beforeResizeObserver = new ResizeObserver(() => {
          requestAnimationFrame(updateBeforeHeight)
        })
        beforeResizeObserver.observe(beforeRef.value)
      }

      if (stickyRef.value && typeof ResizeObserver !== 'undefined') {
        stickyResizeObserver = new ResizeObserver(() => {
          requestAnimationFrame(updateStickyHeight)
        })
        stickyResizeObserver.observe(stickyRef.value)
      }
    })
  })

  onUnmounted(() => {
    beforeResizeObserver?.disconnect()
    stickyResizeObserver?.disconnect()
    if (scrollDebounceTimer) {
      clearTimeout(scrollDebounceTimer)
    }
  })

  defineExpose({
    beforeHeight,
    stickyHeight,
    scrollToIndex,
    scrollToOffset,
    scrollToEnd: scrollable.scrollToEnd,
    scrollToStart: scrollable.scrollToStart,
    scrollPosition: scrollable.scrollPosition,
    isScrolledToEnd: scrollable.isScrolledToEnd,
    isScrolledToStart: scrollable.isScrolledToStart,
    container: containerRef,
    virtualizer
  })
</script>

<style scoped lang="scss">
  .virtual-scrollable-sticky {
    position: sticky;
    top: 0;
    z-index: 10;
    background: color-mix(in oklab, var(--bg-color) 92%, transparent);
    backdrop-filter: blur(16px);
  }
</style>
