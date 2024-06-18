<template>
  <Teleport to="body">
    <Transition @before-enter="onBeforeEnter" @enter="onEnter" @leave="onLeave" :css="false">
      <div v-if="isOpen" @keydown.esc="modalStore.close()"
        :class="{ 'align-start': isCommandLine, 'align-center': !isCommandLine }" tabindex="0" class="modal"
        aria-modal="true">
        <component ref="modal" @click.stop :is="view" :model="model"></component>

      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useModal } from '@/entities/modal/store'
import { onClickOutside } from '@vueuse/core'
import gsap from 'gsap'
import { storeToRefs } from 'pinia'
import { reactive, ref } from 'vue'

//Provide model
//Also can provide actions 
const model = reactive({})
// Ref to modal component
const modal = ref(null)
const modalStore = useModal()
const { isOpen, isCommandLine, view, actions } = storeToRefs(modalStore)
//Catch click outside modal window
onClickOutside(modal, () => modalStore.close())
// Animation for modal window
const onBeforeEnter = (el: Element) => {
  gsap.set(el, {
    scale: 0.8,
    opacity: 0
  })
}

const onEnter = (el: Element, done: any) => {
  gsap.to(el, {
    duration: 0.35,
    scale: 1,
    opacity: 1,
    ease: 'back.out(2)',
    onComplete: done
  })
}

const onLeave = (el: Element, done: any) => {
  gsap.to(el, {
    duration: 0.35,
    scale: 0.9,
    opacity: 0,
    ease: 'back.out(2)',
    onComplete: done
  })
}
</script>

<style lang="scss" scoped>
.modal {
  padding: 60px;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  top: 0;
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: auto;
}

.align-start {
  align-items: start;
}

.align-center {
  align-items: center;
}
</style>
