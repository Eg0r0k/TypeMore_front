import { useElementSize } from '@vueuse/core'
import { Ref } from 'vue'

export const useLineJump = (wordsRef: Ref<HTMLElement | null>) => {

    const {width: wordsWrapperWidth} = useElementSize(wordsRef)
    const lineJump = async () => {
        if(!wordsRef.value) return
        
    }

}
