<template>
  <div v-if="room" class="identity">
    <template v-if="session.isHost">
      <TextInput
        v-model="localName"
        v-max-chars="32"
        :placeholder="t('room.name')"
        :aria-label="t('room.name')"
        data-testid="room-name"
        @keydown.enter="commitName"
        @blur="commitName"
      />

      <!--
        One control, two states: the padlock IS the setting. A pair of radio
        pills for a boolean spends a row saying what one glyph says, and the
        lock is the picture everyone already reads as "who can get in".
      -->
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            type="button"
            class="transition-tm focus-ring text-sub hover:text-text flex w-fit cursor-pointer items-center gap-2 rounded-md text-sm [&_svg]:size-4"
            aria-label="visibility"
            :aria-pressed="isPrivate"
            data-testid="visibility-toggle"
            @click="toggleVisibility"
          >
            <component :is="isPrivate ? IconLock : IconLockOpen" />
            {{ t(`room.visibilityKind.${settings.visibility}`) }}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {{ t(isPrivate ? 'room.makeOpen' : 'room.makePrivate') }}
        </TooltipContent>
      </Tooltip>
    </template>

    <!-- A guest reads the same two facts; only the host can change them. -->
    <template v-else>
      <Typography size="l">{{ settings.name }}</Typography>
      <span class="text-sub flex items-center gap-2 text-sm [&_svg]:size-4">
        <component :is="isPrivate ? IconLock : IconLockOpen" aria-hidden="true" />
        {{ t(`room.visibilityKind.${settings.visibility}`) }}
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'

  import { TextInput } from '@/shared/ui/input'
  import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
  import { Typography } from '@/shared/ui/typography'
  import IconLock from '~icons/tabler/lock'
  import IconLockOpen from '~icons/tabler/lock-open'

  import { useRoomSettings } from '../model/use-room-settings'

  /**
   * What the room IS — its name and who may walk in. It sits with the room code
   * rather than with the run configuration below, because those three answer one
   * question ("which room is this, and can I share it") while the configuration
   * answers another ("what will we be typing").
   */
  const { t } = useI18n()
  const { session, room, settings, apply } = useRoomSettings()

  const isPrivate = computed(() => settings.value.visibility === 'private')
  const toggleVisibility = (): void => apply({ visibility: isPrivate.value ? 'open' : 'private' })

  const localName = ref(settings.value.name)
  watch(
    () => settings.value.name,
    (name) => (localName.value = name)
  )
  const commitName = (): void => {
    const name = localName.value.trim()
    if (!name || name === settings.value.name) return
    apply({ name })
  }
</script>

<style lang="scss" scoped>
  .identity {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
</style>
