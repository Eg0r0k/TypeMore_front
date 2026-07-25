<template>
  <Dialog v-model:open="open">
    <DialogContent class="gap-2 sm:max-w-[300px]">
      <DialogTitle as-child>
        <Typography class="code-modal__title" size="l" tag-name="h2" color="primary">
          {{ t('servers.join.title') }}
        </Typography>
      </DialogTitle>
      <DialogDescription class="sr-only">{{ t('servers.join.hint') }}</DialogDescription>
      <div class="code-modal__input">
        <TextInput
          v-model="inputCode"
          v-focus
          v-max-chars="6"
          :placeholder="t('servers.join.placeholder')"
          @keydown.enter="sendCode"
        />
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              style="height: 37px"
              size="s"
              :aria-label="t('servers.join.paste')"
              @click="pasteFromClipboard"
            >
              <IconClipboard width="28" height="28" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ t('servers.join.paste') }}</TooltipContent>
        </Tooltip>
      </div>
      <Typography color="sub" size="xs">{{ t('servers.join.hint') }}</Typography>
      <Typography v-if="errorText" class="code-modal__error" color="error" size="xs">
        {{ errorText }}
      </Typography>
      <Button aria-label="join room by code" size="m" color="gray" @click="sendCode">
        {{ t('servers.join.submit') }}
      </Button>
    </DialogContent>
  </Dialog>
</template>

<script lang="ts" setup>
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useAlertStore } from '@/entities/alert'
  import { AlertType } from '@/entities/alert/types/alertData'
  import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/shared/ui/dialog'
  import { useMatchSessionStore } from '@/entities/match'
  import { Button } from '@/shared/ui/button'
  import { TextInput } from '@/shared/ui/input'
  import { Typography } from '@/shared/ui/typography'
  import IconClipboard from '~icons/tabler/clipboard'
  import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/ui/tooltip'

  /**
   * Join-by-code: 6-char room code (§5 — trimmed, case-insensitive; the server
   * upper-cases before lookup). `room_not_found` / `room_full` surface inline
   * from the session store's lastError.
   */
  const open = defineModel<boolean>('open', { required: true })
  const { t } = useI18n()
  const inputCode = ref('')
  const invalid = ref(false)
  const alert = useAlertStore()
  const session = useMatchSessionStore()

  const normalized = computed(() => inputCode.value.trim().toUpperCase())

  // Only errors that arrive AFTER a submit belong to this modal — a stale
  // lastError from an earlier action must not leak in. Object identity marks
  // the baseline.
  const errorBaseline = ref<unknown>(null)
  const submitted = ref(false)

  const errorText = computed(() => {
    if (invalid.value) return t('servers.join.invalid')
    if (!submitted.value) return null
    const err = session.lastError
    if (!err || err === errorBaseline.value) return null
    if (err.code === 'room_not_found') return t('servers.join.notFound')
    if (err.code === 'room_full') return t('servers.join.full')
    return err.message
  })

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      inputCode.value = text
    } catch (e) {
      alert.addAlert({
        type: AlertType.Error,
        msg: `Paste from clipboard failed: ${e}`,
        title: 'Clipboard Error',
        duration: 0
      })
    }
  }

  const sendCode = () => {
    if (normalized.value.length !== 6) {
      invalid.value = true
      return
    }
    invalid.value = false
    errorBaseline.value = session.lastError
    submitted.value = true
    session.joinRoom(normalized.value)
  }

  // Seated: the servers page navigates to /room; this modal just closes.
  watch(
    () => session.room,
    (room) => {
      if (room) open.value = false
    }
  )
</script>

<style lang="scss" scoped>
  .code-modal {
    &__input {
      display: flex;
      align-items: flex-end;
      gap: 5px;
      margin-bottom: 10px;
    }

    &__title {
      margin-bottom: 10px;
    }

    &__error {
      display: block;
    }
  }
</style>
