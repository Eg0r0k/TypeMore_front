import { createApp, h } from 'vue'

export const useResolvedPopUp = (component: any, props: any) => {
  return new Promise((resolve) => {
    const popUpContainer = document.createElement('div')
    document.body.appendChild(popUpContainer)
    const app = createApp({
      setup() {
        const onDestroy = (result: boolean) => {
          app.unmount()
          document.body.removeChild(popUpContainer)
          resolve(result)
        }
        return {
          onDestroy
        }
      },
      render() {
        return h(component, {
          ...props,
          onDestroy: this.onDestroy
        })
      }
    })
    app.mount(popUpContainer)
  })
}
