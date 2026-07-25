<template>
  <div v-if="room" class="players">
    <div class="players__code">
      <Typography color="sub" class="players__label">{{ t('room.code') }}</Typography>
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            type="button"
            class="players__code-value"
            :aria-label="t('room.copy')"
            @click="copyCode"
          >
            <Typography tag-name="span" size="l" color="main">{{ room.code }}</Typography>
            <IconCheck v-if="copied" class="players__code-icon players__code-icon--done" />
            <IconCopy v-else class="players__code-icon" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{{ copied ? t('room.copied') : t('room.copy') }}</TooltipContent>
      </Tooltip>
    </div>
    <div class="players__seats">
      <Typography color="sub" class="players__label">
        {{ t('room.players') }} {{ room.players.length }}/5
      </Typography>
      <ul class="players__list">
        <li v-for="player in room.players" :key="player.playerId" :class="seatClass(player)">
          <div class="seat__head">
            <div class="seat__icons">
              <IconCrown v-if="player.playerId === room.hostPlayerId" class="seat__host-badge" />
              <IconUser v-else />
            </div>
            <span class="seat__nick">{{ player.nick }}</span>
            <span v-if="player.isGuest" class="seat__guest">{{ t('room.guest') }}</span>
            <IconCheck
              v-if="player.ready"
              class="seat__ready"
              role="img"
              :aria-label="t('room.readySeat')"
            />
            <div v-if="session.isHost && player.playerId !== session.selfId" class="seat__actions">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    color="shadow"
                    size="s"
                    :aria-label="t('room.makeHost')"
                    @click="session.transferHost(player.playerId)"
                  >
                    <IconCrown />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{{ t('room.makeHost') }}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    color="shadow"
                    size="s"
                    :aria-label="t('room.kick')"
                    @click="session.kickPlayer(player.playerId)"
                  >
                    <IconUserX />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{{ t('room.kick') }}</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <FreemodChips :freemods="player.freemods" class="seat__mods" />
        </li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import clsx from 'clsx'
  import { FreemodChips } from '@/entities/lobby'
  import type { RoomPlayer } from '@/entities/lobby'
  import { useMatchSessionStore } from '@/entities/match'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'
  import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/ui/tooltip'
  import IconCheck from '~icons/tabler/check'
  import IconCopy from '~icons/tabler/copy'
  import IconCrown from '~icons/tabler/crown'
  import IconUser from '~icons/tabler/user'
  import IconUserX from '~icons/tabler/user-x'

  /**
   * Seat list straight off `room_state`: nick + guest styling, host crown,
   * ready flag, per-seat freemod chips, and (host-only) kick / transfer-host
   * affordances. The room code is the invite — click to copy.
   */
  const { t } = useI18n()
  const session = useMatchSessionStore()
  const room = computed(() => session.room)

  const seatClass = (player: RoomPlayer) =>
    clsx('seat', {
      'seat--me': player.playerId === session.selfId,
      'seat--guest': player.isGuest,
      'seat--ready': player.ready
    })

  const copied = ref(false)
  let copyTimer: ReturnType<typeof setTimeout> | null = null
  const copyCode = async () => {
    if (!room.value) return
    try {
      await navigator.clipboard.writeText(room.value.code)
      copied.value = true
      if (copyTimer) clearTimeout(copyTimer)
      copyTimer = setTimeout(() => (copied.value = false), 1500)
    } catch {
      // Clipboard unavailable (permissions/insecure context) — the code stays
      // visible for manual copying; nothing to do.
    }
  }
</script>

<style lang="scss" scoped>
  .seat {
    padding: 0.375rem 0;

    &__head {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    &__icons {
      display: flex;
    }

    &__host-badge {
      color: var(--main-color);
    }

    &__guest {
      font-size: 0.75rem;
      color: var(--sub-color);
    }

    &__ready {
      color: var(--main-color);
    }

    &__actions {
      display: flex;
      margin-left: auto;
    }

    &__mods {
      margin-top: 0.25rem;
    }

    &--me .seat__nick {
      color: var(--main-color);
    }

    &--guest .seat__nick {
      color: var(--sub-color);
    }
  }

  .players {
    display: flex;
    flex-direction: column;
    gap: 1rem;

    &__code-value {
      display: flex;
      align-items: center;
      padding: 0;
      background: none;
      border: none;
      gap: 0.5rem;
      cursor: pointer;
    }

    &__code-icon {
      color: var(--sub-color);

      &--done {
        color: var(--main-color);
      }
    }

    &__list {
      overflow-y: auto;
      height: 12rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
  }
</style>
