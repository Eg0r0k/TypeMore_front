import type { Directive } from 'vue'

// The handler is kept per-element so `unmounted` can remove exactly what
// `mounted` attached — a directive outlives none of its listeners.
const handlers = new WeakMap<HTMLElement, (event: Event) => void>()

const VMaxChars: Directive<HTMLInputElement | HTMLTextAreaElement, number> = {
  mounted(el, binding) {
    const maxLength = binding.value
    const onInput = (event: Event) => {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement
      if (target.value.length > maxLength) {
        target.value = target.value.slice(0, maxLength)
      }
      // Non-bubbling on purpose: it re-notifies listeners on the target itself
      // (v-model) without re-entering this bubbled-to handler.
      target.dispatchEvent(new Event('input'))
    }
    handlers.set(el, onInput)
    el.addEventListener('input', onInput)
  },
  unmounted(el) {
    const onInput = handlers.get(el)
    if (onInput) {
      el.removeEventListener('input', onInput)
      handlers.delete(el)
    }
  }
}

export default VMaxChars
