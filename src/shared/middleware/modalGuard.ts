import { useModal } from '@/entities/modal'
import { RouteLocationNormalizedLoaded } from 'vue-router'

export function handleModalClose(
  to: RouteLocationNormalizedLoaded,
  from: RouteLocationNormalizedLoaded,
  next: any
) {
  const modalStore = useModal()
  if (modalStore.isOpen) {
    modalStore.close()
  }
  next()
}
