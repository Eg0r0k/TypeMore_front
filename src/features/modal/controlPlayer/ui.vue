<template>
  <div class="control-modal">
    <Typography class="control-modal__title" tag-name="h2" size="l">
      User settings for:
      <Typography tag-name="span" size="l">({{ username }})</Typography>
    </Typography>
    <Button color="gray" @click="giveLeader" button-label="Give leader player">
      <template #left-icon>
        <Icon width="20" icon="mdi:crown" />
      </template>
      Give leader
    </Button>
    <Button color="error" @click="banUser" button-label="Ban player">
      <template #left-icon>
        <Icon width="20" icon="mdi:court-hammer" />
      </template>
      Ban
    </Button>
  </div>
</template>

<script setup lang="ts">
  import { useModal } from '@/entities/modal'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'
  import { Icon } from '@iconify/vue'

  const modal = useModal()
  const username = modal.data?.username

  const giveLeader = () => {
    console.log(`Giving leader role to user ${username}`)
  }

  const banUser = () => {
    console.log(`Banning user ${username}`)
  }
</script>

<style lang="scss" scoped>
  .control-modal {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    padding: 1.5rem;
    max-width: 400px;
    background: var(--bg-color);
    border-radius: var(--border-radius);
    box-shadow: 0 0 0 0.2em var(--sub-alt-color);

    &__title {
      margin-bottom: 10px;
    }
  }
</style>
