import { ref, computed, onMounted, onUnmounted, type Ref, nextTick } from 'vue'
import {
  IS_MOBILE_SAFARI,
  IS_OVERLAY_SCROLL_SUPPORTED,
  IS_SAFARI,
  IS_TOUCH_SUPPORTED
} from '@/shared/lib/helpers/environment'

export interface ScrollableOptions {
  direction?: 'vertical' | 'horizontal'
  onScrollOffset?: number
  onScrolledTop?: () => void
  onScrolledBottom?: () => void
  onAdditionalScroll?: () => void
}

export interface ScrollToOptions {
  element?: HTMLElement
  position?: number
  behavior?: ScrollBehavior
}

const USE_OWN_SCROLL = !IS_OVERLAY_SCROLL_SUPPORTED
const SCROLL_THROTTLE = 24

const throttleMeasurement = USE_OWN_SCROLL
  ? (callback: () => void) => requestAnimationFrame(callback)
  : (callback: () => void) => window.setTimeout(callback, SCROLL_THROTTLE)

const cancelMeasurement = USE_OWN_SCROLL
  ? (id: number) => cancelAnimationFrame(id)
  : (id: number) => window.clearTimeout(id)

export default function useScrollable(
  containerRef: Ref<HTMLElement | null>,
  options: ScrollableOptions = {}
) {
  const {
    direction = 'vertical',
    onScrollOffset = 300,
    onScrolledTop,
    onScrolledBottom,
    onAdditionalScroll
  } = options

  const props = computed(() => {
    if (direction === 'vertical') {
      return {
        scrollPosition: 'scrollTop' as const,
        scrollSize: 'scrollHeight' as const,
        clientSize: 'clientHeight' as const,
        offsetSize: 'offsetHeight' as const,
        clientAxis: 'clientY' as const
      }
    }
    return {
      scrollPosition: 'scrollLeft' as const,
      scrollSize: 'scrollWidth' as const,
      clientSize: 'clientWidth' as const,
      offsetSize: 'offsetWidth' as const,
      clientAxis: 'clientX' as const
    }
  })

  const lastScrollPosition = ref(0)
  const lastScrollDirection = ref(0)
  const isHeavyAnimationInProgress = ref(false)
  const needCheckAfterAnimation = ref(false)
  const loadedAll = ref({ top: true, bottom: false })

  const thumbRef = ref<HTMLElement | null>(null)
  const thumbSize = ref(0)
  const thumbPosition = ref(0)
  const isDragging = ref(false)

  let onScrollMeasure: number | null = null
  let resizeObserver: ResizeObserver | null = null

  let startMousePosition = 0
  let startScrollPosition = 0

  const scrollPositionRef = ref(0)

  const scrollPosition = computed({
    get: () => scrollPositionRef.value,
    set: (value: number) => {
      scrollPositionRef.value = value
      if (containerRef.value) {
        containerRef.value[props.value.scrollPosition] = value
      }
    }
  })

  const scrollSize = computed(() => containerRef.value?.[props.value.scrollSize] ?? 0)
  const clientSize = computed(() => containerRef.value?.[props.value.clientSize] ?? 0)
  const offsetSize = computed(() => containerRef.value?.[props.value.offsetSize] ?? 0)

  const isScrolledToEnd = computed(() => {
    const distance = scrollSize.value - Math.round(scrollPosition.value + offsetSize.value)
    return distance <= 1
  })

  const isScrolledToStart = computed(() => scrollPosition.value <= 1)

  function updateThumb(position: number = scrollPosition.value) {
    if (!USE_OWN_SCROLL || !containerRef.value) return

    if (isDragging.value) return

    requestAnimationFrame(() => {
      const container = containerRef.value
      if (!container) return

      const scrollSizeVal = container[props.value.scrollSize]
      const clientSizeVal = container[props.value.clientSize]

      if (clientSizeVal >= scrollSizeVal) {
        thumbSize.value = 0
        return
      }

      const newThumbSize = Math.max(20, clientSizeVal ** 2 / scrollSizeVal)

      const maxScroll = scrollSizeVal - clientSizeVal
      const maxThumbPos = clientSizeVal - newThumbSize

      thumbSize.value = newThumbSize
      thumbPosition.value = maxScroll > 0 ? (position / maxScroll) * maxThumbPos : 0
    })
  }

  function checkForTriggers() {
    if (!onScrolledTop && !onScrolledBottom) return
    if (isHeavyAnimationInProgress.value || !scrollSize.value) return

    const maxScrollPosition = scrollSize.value - clientSize.value

    if (onScrolledTop && scrollPosition.value <= onScrollOffset && lastScrollDirection.value <= 0) {
      onScrolledTop()
    }

    if (
      onScrolledBottom &&
      maxScrollPosition - scrollPosition.value <= onScrollOffset &&
      lastScrollDirection.value >= 0
    ) {
      onScrolledBottom()
    }
  }

  function handleScroll() {
    if (isHeavyAnimationInProgress.value) {
      cancelMeasure()
      needCheckAfterAnimation.value = true
      return
    }

    if (isDragging.value) return

    if (onScrollMeasure) return

    onScrollMeasure = throttleMeasurement(() => {
      onScrollMeasure = null

      if (isDragging.value) return

      const currentPosition = containerRef.value?.[props.value.scrollPosition] ?? 0
      scrollPositionRef.value = currentPosition

      if (lastScrollPosition.value === currentPosition) {
        lastScrollDirection.value = 0
      } else if (lastScrollPosition.value < currentPosition) {
        lastScrollDirection.value = 1
      } else {
        lastScrollDirection.value = -1
      }
      lastScrollPosition.value = currentPosition

      if (USE_OWN_SCROLL) {
        updateThumb(currentPosition)
      }

      onAdditionalScroll?.()
      checkForTriggers()
    })
  }

  function cancelMeasure() {
    if (onScrollMeasure) {
      cancelMeasurement(onScrollMeasure)
      onScrollMeasure = null
    }
  }

  const setScrollLocked = (locked: boolean) => {
    if (!containerRef.value) return
    containerRef.value.style.overflow = locked ? 'hidden' : ''
  }

  function handleThumbMouseDown(e: MouseEvent) {
    if (!USE_OWN_SCROLL || !containerRef.value) return

    e.preventDefault()
    e.stopPropagation()

    isDragging.value = true

    startMousePosition = e[props.value.clientAxis]
    startScrollPosition = containerRef.value[props.value.scrollPosition]

    window.addEventListener('mousemove', handleThumbMouseMove)
    window.addEventListener('mouseup', handleThumbMouseUp, { once: true })
  }

  function handleThumbMouseMove(e: MouseEvent) {
    e.preventDefault()

    const container = containerRef.value
    if (!container) return

    const contentSize = container[props.value.scrollSize]
    const viewportSize = container[props.value.clientSize]
    const currentThumbSize = thumbSize.value

    if (viewportSize >= contentSize) return

    const maxScroll = contentSize - viewportSize
    const maxThumbOffset = viewportSize - currentThumbSize

    if (maxThumbOffset <= 0) return

    const delta = e[props.value.clientAxis] - startMousePosition
    const scrollAmount = (delta / maxThumbOffset) * maxScroll

    const newScrollPos = Math.max(0, Math.min(maxScroll, startScrollPosition + scrollAmount))

    container[props.value.scrollPosition] = newScrollPos
    thumbPosition.value = (newScrollPos / maxScroll) * maxThumbOffset
  }

  function handleThumbMouseUp() {
    isDragging.value = false
    window.removeEventListener('mousemove', handleThumbMouseMove)
  }

  function handleWheel(e: WheelEvent) {
    if (direction !== 'horizontal' || IS_TOUCH_SUPPORTED) return

    const container = containerRef.value
    if (!container) return

    const currentScrollWidth = container.scrollWidth
    const currentClientWidth = container.clientWidth

    if (!e.deltaX && currentScrollWidth > currentClientWidth) {
      container.scrollLeft += e.deltaY / 4
      e.preventDefault()
      e.stopPropagation()
    }
  }

  async function scrollTo(opts: ScrollToOptions): Promise<void> {
    const container = containerRef.value
    if (!container) return

    let targetPosition: number

    if (opts.element) {
      const rect = opts.element.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      if (direction === 'vertical') {
        targetPosition = container.scrollTop + rect.top - containerRect.top
      } else {
        targetPosition = container.scrollLeft + rect.left - containerRect.left
      }
    } else {
      targetPosition = opts.position ?? 0
    }

    container.scrollTo({
      [direction === 'vertical' ? 'top' : 'left']: targetPosition,
      behavior: opts.behavior ?? 'smooth'
    })
  }

  function scrollToEnd(behavior: ScrollBehavior = 'smooth') {
    // LIVE read, not the `scrollSize` computed: that computed's only reactive
    // dependency is `containerRef`, so after the first read it caches whatever
    // the content measured THEN and never invalidates — DOM size is not
    // reactive. Scrolling to the cached size sent a grown list toward where
    // its end used to be, i.e. UP (the chat's "send a message, jump to the
    // top" bug).
    const container = containerRef.value
    if (container === null) return
    scrollTo({ position: container[props.value.scrollSize], behavior })
  }

  function scrollToStart(behavior: ScrollBehavior = 'smooth') {
    scrollTo({ position: 0, behavior })
  }

  function setScrollPositionSilently(value: number) {
    lastScrollPosition.value = value
    const container = containerRef.value
    if (!container) return

    container.removeEventListener('scroll', handleScroll)
    scrollPosition.value = value

    requestAnimationFrame(() => {
      container.addEventListener('scroll', handleScroll, { passive: true })
    })
  }

  function onSizeChange() {
    if (USE_OWN_SCROLL) {
      handleScroll()
    }
  }

  onMounted(() => {
    const container = containerRef.value
    if (!container) return

    container.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })

    resizeObserver = new ResizeObserver(() => {
      handleScroll()
    })
    resizeObserver.observe(container)

    if (direction === 'horizontal' && !IS_TOUCH_SUPPORTED) {
      container.addEventListener('wheel', handleWheel, { passive: false })
    }

    if (USE_OWN_SCROLL) {
      updateThumb()
    }
  })

  nextTick(() => {
    onSizeChange()
  })

  onUnmounted(() => {
    const container = containerRef.value
    if (!container) return

    container.removeEventListener('scroll', handleScroll)
    window.removeEventListener('resize', handleScroll)

    if (resizeObserver) {
      resizeObserver.disconnect()
    }

    if (direction === 'horizontal' && !IS_TOUCH_SUPPORTED) {
      container.removeEventListener('wheel', handleWheel)
    }

    if (USE_OWN_SCROLL) {
      window.removeEventListener('mousemove', handleThumbMouseMove)
    }

    cancelMeasure()
  })

  return {
    containerRef,
    thumbRef,
    scrollPosition,
    scrollSize,
    clientSize,
    offsetSize,
    lastScrollDirection,
    loadedAll,
    isScrolledToEnd,
    isScrolledToStart,
    USE_OWN_SCROLL,
    IS_MOBILE_SAFARI,
    IS_SAFARI,
    thumbSize,
    thumbPosition,
    isDragging,
    handleThumbMouseDown,
    scrollTo,
    scrollToEnd,
    setScrollLocked,
    scrollToStart,
    setScrollPositionSilently,
    updateThumb,
    checkForTriggers,
    onSizeChange
  }
}
