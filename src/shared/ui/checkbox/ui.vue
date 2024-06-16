<template>
    <div class="checkbox-wrapper">
        <label class="checkbox-wrapper__field" for="">
            <slot>
                {{ label }}
            </slot>
        </label>
        <input v-model="modelValue" type="checkbox" :value="value" :name="name" :disabled="disabled"
            class="checkbox-wrapper__input" @input="$emit('input', $event)" @change="$emit('change', $event)" />
        <div class="checkbox-wrapper__checkmark">
            <font-awesome-icon icon="fa-check" class="checkbox-wrapper__icon" />
        </div>
    </div>
</template>

<script setup lang="ts" generic="T">
interface Props {
    value: string | number | boolean;
    label?: string
    name?: string;
    disabled?: boolean;
}
withDefaults(defineProps<Props>(), {
    name: "checkbox",
    label: ''
})

defineEmits<{
    (e: "update:modelValue", value: string): void;
    (e: "input", event: Event): void;
    (e: "change", event: Event): void;
}>();
const modelValue = defineModel<T>();
</script>

<style scoped lang="scss">
.checkbox-wrapper {
    //TODO: add styles for checkbox
}
</style>