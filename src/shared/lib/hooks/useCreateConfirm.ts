import { defineAsyncComponent } from 'vue'
import { useResolvedPopUp } from './useResolvedPopUp'

export const useConform = (props: boolean) => {
  const closePopUp = defineAsyncComponent(() => import('@/features/popup/index'))
  return useResolvedPopUp(closePopUp, props)
}
