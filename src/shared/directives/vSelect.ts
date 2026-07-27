import type { Directive } from 'vue'
import { getInputOrTextarea, type TextInputComponent } from './utils'
import logger from '@/shared/lib/helpers/logger'

const VSelect: Directive = {
  mounted(el: HTMLElement & TextInputComponent) {
    const inputEl = getInputOrTextarea(el)
    if (inputEl) {
      inputEl.focus()
      inputEl.select()
    } else {
      logger.warn('[v-select] Не удалось найти элемент <input> или <textarea>.')
    }
  }
}

export default VSelect
