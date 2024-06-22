<template>
    <div class="checkbox-wrapper">
        <label class="checkbox-wrapper__field">
            <input v-model="modelValue" type="checkbox" :value="value" :name="name" :disabled="isDisabled"
                class="checkbox-wrapper__input" @input="$emit('input', $event)" @change="$emit('change', $event)" />
            <span class="checkbox-wrapper__label">
                <slot>
                    {{ label }}
                </slot>
            </span>
        </label>
    </div>
</template>

<script setup lang="ts" generic="T">
interface Props {
    value: string | number | boolean;
    label?: string
    name?: string;
    isDisabled?: boolean;
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
    display: flex;
    align-items: center;
}

.checkbox-wrapper__field {
    display: flex;
    align-items: center;
    cursor: pointer;
}

.checkbox-wrapper__input {
    box-shadow: 0 0 0 1px var(--main-color);
    appearance: none;
    width: 20px;
    height: 20px;
    background-color: var(--sub-alt-color);
    border-radius: 3px;
    cursor: pointer;
    position: relative;
    display: inline-block;
    margin-right: 8px;
}

.checkbox-wrapper__input:checked {
    background-color: var(--main-color)
}

.checkbox-wrapper__input:checked::before {
    content: '';
    position: absolute;

    width: 5px;
    height: 13px;
    border: solid var(--bg-color);
    left: 6px;
    border-width: 0 3px 3px 0;
    transform: rotate(45deg);
}

.checkbox-wrapper__input:disabled {
    cursor: not-allowed;
    opacity: 0.6;
}

.checkbox-wrapper__label {
    user-select: none;
}
</style>
