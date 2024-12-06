import type { Directive } from 'vue'

interface TextInputComponent {
  getInputRef?: () => HTMLInputElement | null
}

const vSelect: Directive = {
  mounted(el: HTMLElement & TextInputComponent) {
    const inputEl = getInput(el)
    if (!inputEl) {
      console.warn('[v-select] Не удалось найти input элемент.')
      return
    }
    inputEl.focus()
    inputEl.select()
  }
}

const getInput = (el: HTMLElement & TextInputComponent): HTMLInputElement | null => {
  if (el.getInputRef) {
    return el.getInputRef() || null
  }
  return el.querySelector('input')
}

export default vSelect
