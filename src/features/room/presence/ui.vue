<template>
  <!-- Not dismissable by Escape or a click outside: the whole point is that
       nobody is at the keyboard, so an accidental dismissal from a stray
       pointer event would defeat it. The one way to keep the seat is to say so.
       (Activity anywhere in the window also answers it — see the composable.) -->
  <Dialog :open="presence.prompting.value">
    <DialogContent
      class="gap-3 sm:max-w-[340px]"
      :dismissible="false"
      data-testid="presence-modal"
    >
      <DialogTitle as-child>
        <Typography size="l" tag-name="h2" color="primary">
          {{ t('room.presence.title') }}
        </Typography>
      </DialogTitle>
      <DialogDescription as-child>
        <Typography size="s" color="sub">
          {{ t('room.presence.body', { seconds: presence.secondsLeft.value }) }}
        </Typography>
      </DialogDescription>
      <Button size="m" color="main-outline" data-testid="presence-confirm" @click="presence.confirm">
        {{ t('room.presence.confirm') }}
      </Button>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'
  import type { LobbyPresence } from './model/use-lobby-presence'

  /**
   * "Are you still there?" — the visible half of the lobby presence check.
   *
   * Takes the presence object rather than owning it: the page decides when the
   * check is armed (lobby only), and a modal that started its own timers would
   * be a second place that has to know about phases.
   */
  defineProps<{ presence: LobbyPresence }>()

  const { t } = useI18n()
</script>
