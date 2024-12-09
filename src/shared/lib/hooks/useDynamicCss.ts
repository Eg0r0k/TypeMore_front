//* Temp hook later can be rewrite

import { onBeforeUnmount, ref } from 'vue'
import { isValidUrl } from '../helpers/validation'

export const useDynamicCss = () => {
  // ref to head link
  const currentLink = ref<HTMLLinkElement | null>(null)
  /**
   *  Load css file into html head. Unload old link css if its exist 
   * 
   * @param href - css path to style  
   * @returns 
   */
  const loadCss = (href: string) => {
    if (!isValidUrl(href)) {
      console.error(`Incorrect URL for CSS: ${href}`)
      return
    }
    unloadCss()

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.dataset.dynamic = 'true'
    document.head.appendChild(link)

    currentLink.value = link
  }

  const unloadCss = () => {
    if (currentLink.value) {
      document.head.removeChild(currentLink.value)
      currentLink.value = null
    }
  }

  onBeforeUnmount(() => {
    unloadCss()
  })
  return { loadCss, unloadCss }
}
