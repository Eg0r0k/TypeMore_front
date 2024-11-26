import { Ref, ref } from 'vue'
import { useTestStateStore } from '@/entities/test'

export const useLineJump = (wordsRef: Ref<HTMLElement | null>) => {
  const testStore = useTestStateStore()
  const currentTestLine = ref(0)
  let lineTransition = false

  const lineJump = async () => {
    if (!wordsRef.value || lineTransition) return

    const wordElements = wordsRef.value.querySelectorAll('.word')
    if (wordElements.length === 0) return

    const currentWordElement = wordElements[testStore.currentWordElementIndex] as HTMLElement
    if (!currentWordElement) return

    const currentWordTop = currentWordElement.offsetTop

    // Only proceed if we're past the first line
    if (currentTestLine.value > 0) {
      // Find words to hide
      const toHide: HTMLElement[] = []
      for (let i = 0; i < testStore.currentWordElementIndex; i++) {
        const word = wordElements[i] as HTMLElement
        if (word.style.display === 'none') continue

        const wordTop = Math.floor(word.offsetTop)
        if (wordTop < currentWordTop - 10) {
          toHide.push(word)
        }
      }

      // Hide words immediately
      lineTransition = true
      toHide.forEach((word) => {
        word.style.display = 'none'
      })
      lineTransition = false
    }

    // Increment line counter after processing
    currentTestLine.value++
  }

  return {
    lineJump,
    currentTestLine
  }
}
