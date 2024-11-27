import { useInputStore } from '@entities/input/model/store'
import { useTestStateStore } from '@/entities/test/model/store'

import { useElementSize } from '@vueuse/core'
import { Ref } from 'vue'

export const useScrollTape = (wordsRef: Ref<HTMLElement | null>) => {
  const testStore = useTestStateStore()
  const inputStore = useInputStore()
  const { width: wordsWrapperWidth } = useElementSize(wordsRef)

  const scrollTape = async () => {
    if (!wordsRef.value) return
    let fullWordWidth = 0
    let widthToHide = 0
    const toHide: HTMLElement[] = []
    if (testStore.currentWordElementIndex > 0) {
      const wordElements = wordsRef.value.querySelectorAll('.word')
      for (let i = 0; i < testStore.currentWordElementIndex; i++) {
        const word = wordElements[i] as HTMLElement
        fullWordWidth +=
          word.offsetWidth +
          parseFloat(getComputedStyle(word).marginLeft) +
          parseFloat(getComputedStyle(word).marginRight)
        const forWordLeft = Math.floor(word.offsetLeft)
        const forWordWidth = Math.floor(word.offsetWidth)
        if (forWordLeft < 0 - forWordWidth) {
          toHide.push(word)
          widthToHide +=
            word.offsetWidth +
            parseFloat(getComputedStyle(word).marginLeft) +
            parseFloat(getComputedStyle(word).marginRight)
        }
        const currentMargin = parseFloat(getComputedStyle(wordsRef.value).marginLeft)
        wordsRef.value.style.marginLeft = `${currentMargin + widthToHide}px`
      }
    }
    let currentWordWidth = 0
    if (inputStore.getCurrent.length > 0) {
      const words = wordsRef.value.querySelectorAll('.word')
      const letters = words[testStore.currentWordElementIndex]?.querySelectorAll('span')
      if (letters) {
        for (let i = 0; i < inputStore.getCurrent.length; i++) {
          const letter = letters[i] as HTMLElement
          currentWordWidth +=
            letter.offsetWidth +
            parseFloat(getComputedStyle(letter).marginLeft) +
            parseFloat(getComputedStyle(letter).marginRight)
        }
      }
    }
    const newMargin = wordsWrapperWidth.value / 2 - (fullWordWidth + currentWordWidth)
    wordsRef.value.style.transition = '0.125s'
    wordsRef.value.style.marginLeft = `${newMargin}px`
  }
  return {
    scrollTape
  }
}
