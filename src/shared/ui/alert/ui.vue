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
    <div class="flex w-full flex-col">
      <div class="mb-2 flex flex-row items-center gap-3">
        <component
          :is="iconComponent"
          aria-hidden="true"
          width="24"
          height="24"
          :class="accentIcon"
        />
        <h2 :id="titleId" class="text-lg font-semibold">
          {{ props.title || defaultTitles[props.type] }}
        </h2>
      </div>
      <div class="max-h-[100px] w-full overflow-y-auto text-sub [scrollbar-width:thin]">
        <p :id="messageId">{{ props.msg }}</p>
      </div>
    </div>
    <button
      v-if="props.closable"
      class="flex h-min cursor-pointer items-center justify-center rounded-md p-2 text-sub transition-tm hover:text-text focus-ring"
      aria-label="Close alert"
      @click.stop.prevent="close"
    >
      <IconX width="20" height="20" />
    </button>
  </div>
</template>

<script lang="ts" setup>
  import { DEFAULT_ALERT_CLOSABLE, DEFAULT_ALERT_DURATION } from '@/entities/alert/const/values'
  import IconAlertCircle from '~icons/tabler/alert-circle'
  import IconInfoCircle from '~icons/tabler/info-circle'
  import IconCircleCheck from '~icons/tabler/circle-check'
  import IconAlertTriangle from '~icons/tabler/alert-triangle'
  import IconX from '~icons/tabler/x'
  import { useSound } from '@vueuse/sound'
  import { computed, onMounted, ref } from 'vue'
  import type { Component } from 'vue'
  import Error from '/static/sounds/Error.mp3'
  import Info from '/static/sounds/Stop.mp3'
  import { useConfigStore } from '@/entities/config'
  import { cn } from '@/shared/lib/utils'
  import { alertVariants, alertIconVariants, type AlertVariants } from './index'
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
  const alertIcons: Record<AlertType, Component> = {
    [AlertType.Error]: IconAlertCircle,
    [AlertType.Info]: IconInfoCircle,
    [AlertType.Success]: IconCircleCheck,
    [AlertType.Warning]: IconAlertTriangle
  }
  const iconComponent = computed(() => alertIcons[props.type])

  const emit = defineEmits<{
    (e: 'close'): void
  }>()

  const accentIcon = computed(() =>
    alertIconVariants({ type: props.type as AlertVariants['type'] })
  )
  const classes = computed(() => cn(alertVariants({ type: props.type as AlertVariants['type'] })))
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
