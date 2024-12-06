<template>
  <div class="cookie-modal">
    <div v-if="showDefaultView">
      <div class="cookie-modal__header">
        <Typography size="xl" color="main" class="cookie-modal__title">
          <Icon width="55" icon="mingcute:cookie-line" />
          We use Cookies
        </Typography>
        <Typography size="s" color="primary">
          Our site uses cookies to help improve user experience.
        </Typography>
      </div>
      <div class="cookie-modal__controller">
        <Button button-label="accept all cookies" @click="acceptAllCookies">Accept all</Button>
        <Button button-label="Reject cookies" color="gray" @click="rejectNonEssentialCookies">
          Reject non-essential
        </Button>
        <Button button-label="select cookies" color="gray" @click="toggleView">More options</Button>
      </div>
    </div>
    <div v-else class="cookie-modal__settings">
      <div v-for="cookie in Object.values(cookies)" :key="cookie.type">
        <Typography size="xl" color="primary">{{ cookie.type }}</Typography>
        <CheckBox v-model="cookie.enabled" :value="cookie.type">
          <Typography size="m" color="primary">Apply {{ cookie.type }} cookie</Typography>
        </CheckBox>
      </div>
      <Button button-label="accept selected cookies" @click="acceptSelectedCookies">
        Accept selected
      </Button>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { Button } from '@/shared/ui/button'
  import { Icon } from '@iconify/vue'
  import { Typography } from '@/shared/ui/typography'
  import { CheckBox } from '@/shared/ui/checkbox'
  import { useCookiesConsent } from '@/shared/lib/hooks/useCookiesConsent'

  const {
    cookies,
    showDefaultView,
    toggleView,
    acceptAllCookies,
    rejectNonEssentialCookies,
    acceptSelectedCookies
  } = useCookiesConsent()
</script>
<style lang="scss" scoped>
  .cookie-modal {
    display: flex;
    flex-direction: column;
    width: 450px;
    padding: 24px;
    background: var(--bg-color);
    border-radius: var(--border-radius);
    box-shadow: 0 0 0 0.2em var(--sub-alt-color);

    &__settings {
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    &__title {
      display: flex;
      gap: 14px;
      align-items: center;
    }

    &__header {
      display: flex;
      flex-direction: column;
      width: 100%;
      margin-bottom: 10px;
      user-select: none;
    }

    &__controller {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
  }
</style>
