import { useTestStateStore } from "@/entities/test";
import { useElementBounding } from "@vueuse/core";
import { Ref } from "vue";
export const useLineJump = (wordsRef: Ref<HTMLElement | null>) => {
    const testStore = useTestStateStore();
    const { width: wordsWrapperWidth } = useElementBounding(wordsRef);
  
    const lineJump = async () => {
      if (!wordsRef.value) return;
      if (testStore.currentWordElementIndex > 0) {
        const wordElements = wordsRef.value.querySelectorAll('.word');
        for (let i = 0; i < testStore.currentWordElementIndex; i++) {
          const word = wordElements[i] as HTMLElement;

          const firstChild = word.firstElementChild;
          const forWordTop = firstChild instanceof HTMLElement ? Math.floor(firstChild.offsetTop) : 0;
        
        }
      }
    };
  
    return { lineJump }; 
  };