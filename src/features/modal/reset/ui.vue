<template>
  <div class="reset-modal">
    <Typography class="reset-modal__title" color="primary" tag-name="h2" size="l">
      Reset password
    </Typography>
    <Typography class="reset-modal__sub" color="sub">
      Please enter the email address associated with your account to reset your password.
    </Typography>
    <TextInput>
      <Typography color="primary">
        Email
        <Typography tag-name="span" size="xs" color="error">*</Typography>
      </Typography>
    </TextInput>
    <Button>Sumbit</Button>
  </div>
</template>

<script setup lang="ts">
  import { Button } from '@/shared/ui/button'
  import { TextInput } from '@/shared/ui/input'
  import { Typography } from '@/shared/ui/typography'
</script>

<style lang="scss" scoped>
  .reset-modal {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 600px;
    padding: 24px;
    background: var(--bg-color);
    border-radius: var(--border-radius);
    box-shadow: 0 0 0 0.2em var(--sub-alt-color);

    &__input {
      margin-bottom: 24px;
    }

    &__title {
      margin-bottom: 4px;
    }

    &__sub {
      margin-bottom: 12px;
    }
  }
</style>
