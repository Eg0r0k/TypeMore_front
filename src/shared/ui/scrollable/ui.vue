<template>
  <div :class="wrapperClasses">
    <div
      v-if="scrollable.USE_OWN_SCROLL && showThumbVisible"
      class="scrollable-thumb-container"
      :class="
        direction === 'horizontal' ? 'scrollable-thumb-container-x' : 'scrollable-thumb-container-y'
      "
    >
      <div
        ref="thumbRef"
        class="scrollable-thumb"
        :class="{ 'is-focused': scrollable.isDragging.value }"
        :style="thumbStyle"
        @mousedown="scrollable.handleThumbMouseDown"
      />
    </div>

    <div ref="containerRef" :class="containerClasses" @scroll="handleScrollEmit">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, provide, useTemplateRef } from 'vue'
  import { scrollableInjectionKey } from './lib/injection'
  import useScrollable from './lib/useScrollable'
  import './scrollable.scss'

  interface Props {
    direction?: 'vertical' | 'horizontal'
    onScrollOffset?: number
    bordered?: boolean
    hideThumb?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    direction: 'vertical',
    onScrollOffset: 300,
    bordered: false,
    hideThumb: false
  })

  const emit = defineEmits<{
    scroll: [event: Event]
    scrolledTop: []
    scrolledBottom: []
  }>()

  const containerRef = useTemplateRef('containerRef')

  const scrollable = useScrollable(containerRef, {
    direction: props.direction,
    onScrollOffset: props.onScrollOffset,
    onScrolledTop: () => emit('scrolledTop'),
    onScrolledBottom: () => emit('scrolledBottom')
  })

  function handleScrollEmit(e: Event) {
    emit('scroll', e)
    scrollable.updateThumb()
  }

  const wrapperClasses = computed(() => [
    'scrollable-wrapper',
    props.direction === 'vertical' ? 'scrollable-direction-y' : 'scrollable-direction-x',
    {
      'scrollable-y-bordered': props.bordered && props.direction === 'vertical',
      'scrolled-start': props.bordered && scrollable.isScrolledToStart.value,
      'scrolled-end': props.bordered && scrollable.isScrolledToEnd.value
    }
  ])

  const containerClasses = computed(() => [
    'scrollable',
    props.direction === 'vertical' ? 'scrollable-y' : 'scrollable-x',
    {
      'no-scrollbar': scrollable.USE_OWN_SCROLL,
      'no-scrollbar-safari': scrollable.IS_SAFARI && !scrollable.IS_MOBILE_SAFARI
    }
  ])

  const showThumbVisible = computed(() => !props.hideThumb && scrollable.thumbSize.value > 0)

  const thumbStyle = computed(() => {
    if (props.direction === 'vertical') {
      return {
        height: `${scrollable.thumbSize.value}px`,
        transform: `translateY(${scrollable.thumbPosition.value}px)`
      }
    }
    return {
      width: `${scrollable.thumbSize.value}px`,
      transform: `translateX(${scrollable.thumbPosition.value}px)`
    }
  })

  provide(scrollableInjectionKey, scrollable)

  defineExpose({
    scrollTo: scrollable.scrollTo,
    scrollToEnd: scrollable.scrollToEnd,
    scrollToStart: scrollable.scrollToStart,
    scrollPosition: scrollable.scrollPosition,
    isScrolledToEnd: scrollable.isScrolledToEnd,
    isScrolledToStart: scrollable.isScrolledToStart,
    container: containerRef,
    USE_OWN_SCROLL: scrollable.USE_OWN_SCROLL
  })
</script>
