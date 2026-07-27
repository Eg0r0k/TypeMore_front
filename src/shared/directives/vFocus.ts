import type { Directive } from 'vue'
import { getInputOrTextarea, type TextInputComponent } from './utils'
import logger from '@/shared/lib/helpers/logger'

const VFocus: Directive = {
  mounted(el: HTMLElement & TextInputComponent) {
    const inputEl = getInputOrTextarea(el)
    if (inputEl) {
      inputEl.focus()
    } else {
      logger.warn('[v-focus] Не удалось найти элемент <input> или <textarea>.')
    }
  }
}

export default VFocus
