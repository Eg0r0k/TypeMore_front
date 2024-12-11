import type { Directive } from 'vue'
import { getInputOrTextarea, type TextInputComponent } from './utils'

const VFocus: Directive = {
  mounted(el: HTMLElement & TextInputComponent) {
    const inputEl = getInputOrTextarea(el)
    if (inputEl) {
      inputEl.focus()
    } else {
      console.warn('[v-focus] Не удалось найти элемент <input> или <textarea>.')
    }
  }
}

export default VFocus
