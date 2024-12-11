export interface TextInputComponent {
  getInputRef?: () => HTMLInputElement | null
}

export const getInputOrTextarea = (
  el: HTMLElement & TextInputComponent
): HTMLInputElement | HTMLTextAreaElement | null => {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el
  }

  if (el.getInputRef) {
    return el.getInputRef() || null
  }

  return el.querySelector('input, textarea')
}
