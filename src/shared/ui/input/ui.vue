<template>
   <div class="text-input__wrapper">
      <label for="" class="text-input__label" v-if="label">
         <Typography tag-name="p" :size="'s'" color="primary">{{ label }}</Typography>
      </label>
      <component autocomplete="off" dir="auto" :is="props.tagName" type="text" class="text-input"
         :placeholder="placeholder" :disabled="isDisabled" @input="updateInput"
         :class="{ 'text-input--error': props.isError }"> </component>
   </div>
</template>

<script setup lang="ts">
import { Typography } from '@/shared/ui/typography';
interface Props {
   isRequired?: boolean
   placeholder?: string
   isError?: boolean
   isDisabled?: boolean
   inputValue?: string
   label?: string
   modelValue?: string
   tagName?: "input" | "textarea"
}

const props = withDefaults(defineProps<Props>(), {
   tagName: "input"
})
const emit = defineEmits(['update:modelValue'])

const updateInput = (e: any) => {
   emit('update:modelValue', e.target.value)
}
</script>


<style lang="scss" scoped>
textarea {
   user-select: none;
   resize: vertical;
   max-height: 100px;
   min-height: 35px;

   &::-webkit-scrollbar {
      width: 6px;
   }

   &::-webkit-scrollbar-thumb {
      background-color: var(--main-color);
      border-radius: var(--border-radius);

   }
}

.text-input {
   user-select: none;
   width: 100%;
   line-height: normal;
   box-sizing: border-box;
   background-color: var(--sub-color);
   border-radius: var(--border-radius);
   border: none;
   padding: 8px;
   font-size: 16px;
   color: var(--text-color);
   caret-color: var(--main-color);
   position: relative;

   &:focus {
      outline: solid var(--main-color) 1px;
   }

   &__label {
      margin-bottom: 4px;
      display: block;

   }

   &--error {
      outline: 1px solid red;
   }


}
</style>