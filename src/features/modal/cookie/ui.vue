<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="sm:max-w-[450px]"
      :show-close-button="dismissible"
      @interact-outside="onDismissAttempt"
      @escape-key-down="onDismissAttempt"
    >
      <template v-if="showDefaultView">
        <DialogHeader class="cookie-modal__header">
          <DialogTitle as-child>
            <Typography size="xl" color="main" tag-name="h2" class="cookie-modal__title">
              <IconCookie width="55" height="55" />
              We use Cookies
            </Typography>
          </DialogTitle>
          <DialogDescription as-child>
            <Typography size="s" color="primary">
              Our site uses cookies to help improve user experience.
            </Typography>
          </DialogDescription>
        </DialogHeader>
        <div class="cookie-modal__controller">
          <Button button-label="accept all cookies" @click="acceptAllCookies">Accept all</Button>
          <Button button-label="Reject cookies" color="gray" @click="rejectNonEssentialCookies">
            Reject non-essential
          </Button>
          <Button button-label="select cookies" color="gray" @click="toggleView">
            More options
          </Button>
        </div>
      </template>
      <template v-else>
        <DialogTitle class="sr-only">Cookie settings</DialogTitle>
        <DialogDescription class="sr-only">
          Choose which cookies you allow us to use.
        </DialogDescription>
        <div class="flex flex-col gap-4">
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
      </template>
    </DialogContent>
  </Dialog>
</template>

<script lang="ts" setup>
  import { Button } from '@/shared/ui/button'
  import IconCookie from '~icons/tabler/cookie'
  import { Typography } from '@/shared/ui/typography'
  import { CheckBox } from '@/shared/ui/checkbox'
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
  } from '@/shared/ui/dialog'
  import { useCookiesConsent } from '@/shared/lib/hooks/useCookiesConsent'

  /**
   * First-run consent is non-dismissable (`:dismissible="false"`): the user has to
   * pick an option. Re-opened from the settings dialog it behaves like any dialog.
   */
  const open = defineModel<boolean>('open', { required: true })
  const props = withDefaults(defineProps<{ dismissible?: boolean }>(), { dismissible: true })

  const onDismissAttempt = (event: Event): void => {
    if (!props.dismissible) event.preventDefault()
  }

  const {
    cookies,
    showDefaultView,
    toggleView,
    acceptAllCookies,
    rejectNonEssentialCookies,
    acceptSelectedCookies
  } = useCookiesConsent(() => {
    open.value = false
  })
</script>
<style lang="scss" scoped>
  .cookie-modal {
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
