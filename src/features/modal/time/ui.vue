<template>
  <div class="time-modal">
    <Typography class="time-modal__title" size="l" tag-name="h2" color="primary">
      Custrom time amount
    </Typography>
    <TextInput
      @keydown.enter="saveTimeAmount"
      placeholder="Set time (e.g., 24h, 20m10s, 1h30m, 3600)"
      v-model="inputTime"
      v-select
      min="0"
    >
      <Typography tag-name="span" color="primary" size="xxs">
        {{ formattedTime }}
      </Typography>
    </TextInput>
    <Typography color="sub" size="xs">
      You can use "h" for hours and "m" for minutes, for example "1h30m".
    </Typography>
    <Typography size="xs" color="sub">
      You can start an infinite test by inputting 0. Then, to stop the test, use the Bail Out
      feature
    </Typography>
    <Typography color="sub" size="xs">
      (
      <kbd>Shift</kbd>
      +
      <kbd>Space</kbd>
      > Bail Out )
    </Typography>
    <Button buttonLabel="save time amount" size="m" color="gray" @click="saveTimeAmount">ok</Button>
  </div>
</template>

<script lang="ts" setup>
  import { useConfigStore } from '@/entities/config/model/store'
  import { useModal } from '@/entities/modal'
  import { Button } from '@/shared/ui/button'
  import { TextInput } from '@/shared/ui/input'
  import { Typography } from '@/shared/ui/typography'
  import { computed, ref } from 'vue'
  const modal = useModal()
  const configStore = useConfigStore()
  const inputTime = ref(String(configStore.config.time))

  const timeInSeconds = computed(() => {
    const timeRegex = /(\d+)(h|m|s)?/g
    let seconds = 0
    let match
    if (inputTime.value.startsWith('-')) {
      return -1
    }
    if (/^\d+$/.test(inputTime.value)) {
      seconds = parseInt(inputTime.value) || 0
    } else {
      while ((match = timeRegex.exec(inputTime.value)) !== null) {
        const value = parseInt(match[1])
        const unit = match[2]

        switch (unit) {
          case 'h':
            seconds += value * 3600
            break
          case 'm':
            seconds += value * 60
            break
          case 's':
          default:
            seconds += value
            break
        }
      }
    }
    return seconds
  })

  const formattedTime = computed(() => {
    if (timeInSeconds.value === 0) return 'infinity'
    if (timeInSeconds.value === -1) return 'Trying to reverse time? Sorry, no DeLorean here!'

    let totalSeconds = timeInSeconds.value
    const hours = Math.floor(totalSeconds / 3600)
    totalSeconds %= 3600
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    let formatted = ''

    if (hours > 0) {
      formatted += `${hours} ${hours === 1 ? 'hour' : 'hours'}`
    }
    if (minutes > 0) {
      formatted += `${hours > 0 ? ', ' : ''}${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
    }
    if (seconds > 0) {
      formatted += `${
        hours > 0 || minutes > 0 ? ' and ' : ''
      }${seconds} ${seconds === 1 ? 'second' : 'seconds'}`
    }

    return formatted
  })

  const saveTimeAmount = () => {
    configStore.setTime(timeInSeconds.value)
    modal.close()
  }
</script>

<style lang="scss" scoped>
  .time-modal {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    max-width: 500px;
    padding: 1.5rem;
    background: var(--bg-color);
    border-radius: var(--border-radius);
    box-shadow: 0 0 0 0.2em var(--sub-alt-color);

    &__title {
      margin-bottom: 0;
    }
  }
</style>
