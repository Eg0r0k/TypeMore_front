<template>
  <div v-if="room" class="identity">
    <!--
      Labelled like the rest of the column: the room code and the seat list
      below already carry a sub-colored caption, so the name and the padlock
      read as two more rows of the same list rather than a different widget.
    -->
    <template v-if="session.isHost">
      <div class="identity__field flex gap-2 capitalize">
        <Typography color="sub">{{ t('room.name') }}</Typography>
        <TextInput
          v-model="localName"
          v-max-chars="32"
          :placeholder="t('room.name')"
          :aria-label="t('room.name')"
          data-testid="room-name"
          @keydown.enter="commitName"
          @blur="commitName"
        />
      </div>

      <!--
        One control, two states: the padlock IS the setting. A pair of radio
        pills for a boolean spends a row saying what one glyph says, and the
        lock is the picture everyone already reads as "who can get in".
      -->
      <div class="identity__field flex gap-2 capitalize">
        <Typography color="sub">{{ t('room.visibility') }}</Typography>
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
      </div>
    </template>

    <template v-else>
      <div class="identity__field capitalize">
        <Typography color="sub">{{ t('room.name') }}</Typography>
        <Typography size="l">{{ settings.name }}</Typography>
      </div>
      <div class="identity__field capitalize">
        <Typography color="sub">{{ t('room.visibility') }}</Typography>
        <span class="text-sub flex items-center gap-2 text-sm [&_svg]:size-4">
          <component :is="isPrivate ? IconLock : IconLockOpen" aria-hidden="true" />
          {{ t(`room.visibilityKind.${settings.visibility}`) }}
        </span>
      </div>
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
    gap: 1rem;
    align-items: flex-start;

    &__field {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
