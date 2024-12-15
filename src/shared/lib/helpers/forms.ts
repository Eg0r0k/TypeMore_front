import { v4 as uuidv4 } from 'uuid'

export const focusNextField = (event: KeyboardEvent) => {
  if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
    return
  }

  const form = event.target.form
  if (!form) return

  const elements = Array.from(form.elements).filter(
    (el) =>
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLButtonElement
  )

  const index = elements.indexOf(event.target)

  switch (event.key) {
    case 'Enter':
      for (let i = index + 1; i < elements.length; i++) {
        if (!(elements[i] instanceof HTMLButtonElement)) {
          ;(elements[i] as HTMLElement).focus()
          event.preventDefault()
          return
        }
      }
      break
    case 'Backspace':
      if (event.target.value.trim() === '') {
        for (let i = index - 1; i >= 0; i--) {
          if (!(elements[i] instanceof HTMLButtonElement)) {
            ;(elements[i] as HTMLElement).focus()
            event.preventDefault()
            return
          }
        }
      }
      break
  }
}

export const generateId = (prefix: string) => {
  return `${prefix}-${uuidv4()}`
}
