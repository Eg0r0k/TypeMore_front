export default {
  mounted(el: HTMLInputElement | HTMLTextAreaElement, binding: { value: number }) {
    const maxLength = binding.value
    el.addEventListener('input', (event: Event) => {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement
      if (target.value.length > maxLength) {
        target.value = target.value.slice(0, maxLength)
      }
      target.dispatchEvent(new Event('input'))
    })
  }
}
