import { Ref } from 'vue'
import { useTestStateStore } from '@/entities/test/model/store'

//TODO: Add hide from DOM elements out of bounce
//TODO: Make 'jump' after second line
export const useLineJump = (wordsRef: Ref<HTMLElement | null>) => {
  const testStore = useTestStateStore()

  let lineTransition = false

  const lineJump = async (currentTop: number) => {
    if (!wordsRef.value || lineTransition) return

    const wordElements = wordsRef.value.querySelectorAll('.word')
    if (wordElements.length === 0) return

    const currentWordElement = wordElements[testStore.currentWordElementIndex] as HTMLElement
    if (!currentWordElement) return

    const currentWordTop = currentTop

    const toHide: HTMLElement[] = []
    for (let i = 0; i < testStore.currentWordElementIndex; i++) {
      const word = wordElements[i] as HTMLElement
      if (word.style.display === 'none') continue

      const wordTop = Math.floor(word.offsetTop)

      if (wordTop < currentWordTop - 10) {
        toHide.push(word)
      }
    }

    lineTransition = true
    toHide.forEach((word) => {
      word.style.display = 'none'
    })
    lineTransition = false
  }

  return {
    lineJump
  }
}
