<template>

  <div @click="close" ref="alertRef" role="alert" v-if="isVisible" class="alert" :class="classes">
    <div class="alert__header header-alert">
      <Icon width="30" color="white" :icon="iconName" />
      <p class="alert__header__text">{{ props.title || defaultTitles[props.type] }}</p>
    </div>
    <div class="alert__body">
      {{ props.msg }}
    </div>
  </div>


</template>

<script lang="ts" setup>
//TODO: implement alert component
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref } from 'vue';

enum AlertType {
  Error = "error",
  Info = "info",
  Success = "success",
  Warning = "warn",
}
interface Props {
  type: AlertType
  msg: string
  title?: string,
  duration?: number,
  closable?: boolean;

}
const defaultTitles = {
  [AlertType.Error]: 'Error',
  [AlertType.Info]: 'Information',
  [AlertType.Success]: 'Success',
  [AlertType.Warning]: 'Warning',
};


const isVisible = ref(true)
const alertRef = ref(null)

const props = withDefaults(defineProps<Props>(), {
  type: AlertType.Info,
  msg: "This is a default alert message.",
  title: "",
  duration: 0,
  closable: true,
})
const iconName = computed(() => {
  switch (props.type) {
    case AlertType.Error:
      return 'pajamas:error';
    case AlertType.Info:
      return 'pajamas:information-o';
    case AlertType.Success:
      return 'pajamas:check-circle';
    case AlertType.Warning:
      return 'pajamas:warning';
    default:
      return '';
  }
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();


const classes = computed(() => [`alert--${props.type}`])

const close = () => {
  if (!props.closable) return
  isVisible.value = false
  emit('close')
}
onMounted(() => {
  if (props.closable && props.duration > 0) {
    setTimeout(() => {
      close();
    }, props.duration);
  }
});
</script>

<style lang="scss" scoped>
.alert-box {
  position: fixed;
  top: 12px;
  right: 0;
  z-index: var(--alert-z);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.header-alert {
  font-size: 18px;
}



.alert {
  --warn: #fc9403;
  --error: #b82e2e;
  --success: #1aaa55;
  --info: #1f78d1;
  min-width: 320px;
  padding: 22px;
  color: #FFFFFF;
  border-radius: var(--border-radius);
  max-width: 400px;


  &--warn {
    background-color: var(--warn);
  }

  &--error {
    background-color: var(--error);
  }

  &--info {
    background-color: var(--info);
  }

  &--success {
    background-color: var(--success);
  }

  &__header {
    color: #ffffff;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    margin-bottom: 11px;
  
  }

  &__body {
    scrollbar-width: thin;
    max-height: 90px;
    overflow-y: scroll;
  }
}
</style>
