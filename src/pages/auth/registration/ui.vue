<template>
  <div class="registration__wrapper">
    <div class="registration">
      <div class="registration__header">
        <Typography color="main" tag-name="h2" size="xl" class="registration__title"
          >Registration</Typography
        >
        <Typography color="primary" size="m">Fill in all fields to register</Typography>
      </div>
      <form action="" class="registration__body" autocomplete="off">
        <TextInput is-required :placeholder="'Username'" />
        <TextInput is-required :placeholder="'Email'" />
        <TextInput :type="'password'" is-required :placeholder="'Password'" />
        <Button @click.prevent="" type="sumbit" class="registration__sumbit">Create</Button>
      </form>
      <div class="registration__footer">
        <Typography tag-name="p" color="primary"
          >Has accaut?
          <router-link to="/login" class="registration__link">Login</router-link>
        </Typography>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Typography } from '@/shared/ui/typography'
import { TextInput } from '@/shared/ui/input'
import { Button } from '@/shared/ui/button'
</script>

<style scoped lang="scss">
.registration {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  max-width: 359px;
  padding: 32px;
  border: 2px solid var(--sub-alt-color);
  border-radius: var(--border-radius);

  &__body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    margin: 0 auto;
  }

  &__header {
    text-align: center;
  }

  &__title {
    margin-bottom: 8px;
  }

  &__popper,
  &__sumbit {
    width: 100%;
  }
}
</style>
