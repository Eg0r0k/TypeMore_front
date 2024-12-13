<template>
  <div
    v-if="isVisible"
    ref="alertRef"
    role="alertdialog"
    :aria-labelledby="titleId"
    :aria-describedby="messageId"
    :class="classes"
    :aria-live="props.type === AlertType.Error ? 'assertive' : 'polite'"
  >
    <div class="alert__content">
      <div class="alert__header header-alert">
        <Icon aria-hidden="true" width="30" color="white" :icon="iconName" />
        <h2 :id="titleId" class="alert__header__text">
          {{ props.title || defaultTitles[props.type] }}
        </h2>
      </div>
      <div class="alert__body">
        <p :id="messageId">{{ props.msg }}</p>
      </div>
    </div>
    <button
      v-if="props.closable"
      class="alert__close-btn"
      aria-label="Close alert"
      @click.stop.prevent="close"
    >
      <Icon icon="mdi:close" width="25" />
    </button>
  </div>
</template>

<script lang="ts" setup>
  import { DEFAULT_ALERT_CLOSABLE, DEFAULT_ALERT_DURATION } from '@/entities/alert/const/values'
  import { Icon } from '@iconify/vue'
  import { useSound } from '@vueuse/sound'
  import { computed, onMounted, ref } from 'vue'
  import Error from '/static/sounds/Error.mp3'
  import Info from '/static/sounds/Stop.mp3'
  import { useConfigStore } from '@/entities/config/model/store'
  import clsx from 'clsx'
  const titleId = `alert-title-${Date.now()}`
  const messageId = `alert-message-${Date.now()}`
  const { config } = useConfigStore()
  enum AlertType {
    Error = 'error',
    Info = 'info',
    Success = 'success',
    Warning = 'warn'
  }
  interface Props {
    type: AlertType
    msg: string
    title?: string
    duration?: number
    closable?: boolean
  }
  const defaultTitles = {
    [AlertType.Error]: 'Error',
    [AlertType.Info]: 'Information',
    [AlertType.Success]: 'Success',
    [AlertType.Warning]: 'Warning'
  }
  type AlertSound = ReturnType<typeof useSound>

  const alertSounds: Record<AlertType, AlertSound> = {
    [AlertType.Error]: useSound(Error, { volume: config.soundVolume }),
    [AlertType.Info]: useSound(Info, { volume: config.soundVolume }),
    [AlertType.Success]: useSound(Error, { volume: config.soundVolume }), //TODO: Возможно, здесь ошибка, должен быть другой звук
    [AlertType.Warning]: useSound(Info, { volume: config.soundVolume })
  } as const

  const isVisible = ref(true)
  const alertRef = ref(null)

  const props = withDefaults(defineProps<Props>(), {
    type: AlertType.Info,
    msg: 'This is a default alert message.',
    title: '',
    duration: DEFAULT_ALERT_DURATION,
    closable: DEFAULT_ALERT_CLOSABLE
  })
  const alertIcons: Record<AlertType, string> = {
    [AlertType.Error]: 'pajamas:error',
    [AlertType.Info]: 'pajamas:information-o',
    [AlertType.Success]: 'pajamas:check-circle',
    [AlertType.Warning]: 'pajamas:warning'
  } as const
  const iconName = computed(() => alertIcons[props.type])

  const emit = defineEmits<{
    (e: 'close'): void
  }>()

  const classes = computed(() => clsx('alert', `alert--${props.type}`))
  const playSound = () => {
    alertSounds[props.type]?.play()
  }
  const close = () => {
    if (!props.closable) return

    isVisible.value = false
    emit('close')
  }
  //На всякий случай
  defineExpose({
    close
  })
  onMounted(() => {
    if (props.closable && props.duration > 0) {
      setTimeout(close, props.duration)
    }
    setTimeout(playSound, 100)
  })
</script>

<style lang="scss" scoped>
  .header-alert {
    font-size: 18px;
  }

  .alert {
    --warn: #fc9403;
    --error: #b82e2e;
    --success: #2aaf31;
    --info: #1f78d1;
    --main: #fff;

    display: flex;
    flex-direction: row;
    justify-content: space-between;
    width: 100%;
    min-width: 320px;
    max-width: 400px;
    padding: 22px 4px 22px 22px;
    color: var(--main);
    pointer-events: all;
    border-radius: var(--border-radius);

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

    &__close-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      color: var(--main);
      cursor: pointer;
      background-color: transparent;
      border: none;
      transition: all var(--transition-duration);

      &:hover {
        color: rgb(190 188 188);
      }
    }

    &__content {
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    &__header {
      display: flex;
      flex-direction: row;
      gap: 12px;
      align-items: center;
      margin-bottom: 11px;
      color: var(--main);
    }

    &__body {
      width: 100%;
      height: 100%;
      max-height: 100px;
      overflow-y: scroll;
      scrollbar-width: thin;
    }
  }
</style>
