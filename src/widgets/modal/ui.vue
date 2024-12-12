<template>
  <Teleport to="#app" :disabled="!isTeleportAvailable">
    <div v-if="isOpen" class="modal-wrapper"></div>
    <Transition
      :name="transitionName"
      @before-enter="onBeforeEnter"
      @enter="onEnter"
      @leave="onLeave"
      :css="false"
    >
      <div
        v-if="isOpen"
        :class="classes"
        tabindex="-1"
        class="modal"
        aria-modal="true"
        :aria-hidden="!isOpen"
        aria-labelledby="modal-title"
        role="dialog"
        @keydown.esc="handleEscapeKey"
      >
        <h2 id="modal-title" class="sr-only">Modal window</h2>
        <component
          class="modal__component"
          :is="view"
          ref="modal"
          v-bind="model"
          @click.stop
        ></component>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { useModal } from '@/entities/modal/model/store'
  import { onClickOutside } from '@vueuse/core'
  import clsx from 'clsx'
  import gsap from 'gsap'
  import { computed, onMounted, reactive, ref } from 'vue'
  const modalStore = useModal()
  const isOpen = computed(() => modalStore.isOpen)
  const alignment = computed(() => modalStore.alignment)
  const view = computed(() => modalStore.view)
  const justify = computed(() => modalStore.justify)
  const closeOnClickOutside = computed(() => modalStore.closeOnClickOutside)

  const classes = computed(() =>
    clsx(`alignment-${alignment.value || 'center'}`, `justify-${justify.value || 'center'}`)
  )
  const transitionName = computed(() => (isOpen.value ? 'modal-enter' : 'modal-leave'))
  const model = reactive({})
  const isTeleportAvailable = ref(false)
  const modal = ref(null)

  onClickOutside(modal, () => {
    if (closeOnClickOutside.value) {
      modalStore.close()
    }
  })

  const handleEscapeKey = () => {
    if (closeOnClickOutside.value) {
      modalStore.close()
    }
  }

  const onBeforeEnter = (el: Element) => {
    gsap.set(el, {
      scale: 0.8,
      opacity: 0
    })
  }

  const onEnter = (el: Element, done: () => void) => {
    gsap.to(el, {
      duration: 0.35,
      scale: 1,
      opacity: 1,
      ease: 'back.out(2)',
      onComplete: done
    })
  }

  const onLeave = (el: Element, done: () => void) => {
    gsap.to(el, {
      duration: 0.35,
      scale: 0.9,
      opacity: 0,
      ease: 'back.out(2)',
      onComplete: done
    })
  }

  onMounted(() => {
    isTeleportAvailable.value = !!document.querySelector('#wrapper')
  })
</script>

<style lang="scss" scoped>
  .sr-only {
    @include hide-visually;
  }

  .modal {
    position: fixed;
    inset: 0;
    z-index: var(--modal-z);
    box-sizing: border-box;
    display: flex;
    width: 100%;
    max-width: 100%;
    height: 100%;
    max-height: 100%;
    padding: 60px 15px;
    overflow: auto;
  }

  .modal-wrapper {
    position: fixed;
    inset: 0;
    z-index: var(--modal-z);
    background-color: #00000070;
  }

  .justify {
    &-left {
      justify-content: flex-start;
    }

    &-right {
      justify-content: flex-end;
    }

    &-center {
      justify-content: center;
    }

    &-none {
      justify-content: unset;
    }
  }

  .alignment {
    &-top {
      align-items: flex-start;
    }

    &-bottom {
      align-items: flex-end;
    }

    &-center {
      align-items: center;
    }

    &-none {
      align-items: unset;
    }
  }
</style>
