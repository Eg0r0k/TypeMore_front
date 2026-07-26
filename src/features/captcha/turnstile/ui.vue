<template>
  <div v-if="enabled" class="turnstile">
    <div ref="host" class="turnstile__host" />
    <Typography v-if="errorMessage" color="error" size="xs" role="alert">
      {{ errorMessage }}
    </Typography>
  </div>
</template>

<script setup lang="ts">
  import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
  import { Typography } from '@shared/ui/typography'
  import { isCaptchaEnabled, turnstileSiteKey } from './lib/config'
  import { loadTurnstile, type TurnstileApi } from './lib/loader'
  import type { TurnstileFieldExpose } from './lib/form'

  /**
   * The Turnstile challenge as a form field: `v-model` is the token, and an
   * empty token is what the owning form's schema rejects. No site key ⇒ the
   * component renders nothing and the model stays empty, which the schema
   * treats as optional — the form is then byte-for-byte its pre-captcha self.
   */

  defineProps<{
    /** Validation message from the owning form, rendered under the widget. */
    errorMessage?: string
  }>()

  const token = defineModel<string>({ default: '' })

  const enabled = isCaptchaEnabled()
  const host = useTemplateRef<HTMLElement>('host')

  let api: TurnstileApi | null = null
  let widgetId: string | undefined

  const clear = () => {
    token.value = ''
  }

  const exposed: TurnstileFieldExpose = {
    reset: () => {
      // Order matters: drop the spent token first so the form re-blocks even if
      // the script never loaded and there is no widget to reset.
      clear()
      if (widgetId) api?.reset(widgetId)
    }
  }
  defineExpose(exposed)

  onMounted(async () => {
    if (!enabled) return

    let ready: TurnstileApi
    try {
      ready = await loadTurnstile()
    } catch {
      // Blocked, offline, or throttled. Leaving the token empty keeps submit
      // blocked, which is the safe direction for an abuse-prone endpoint.
      return
    }

    // The await above can outlive the component.
    if (!host.value) return

    api = ready
    widgetId = ready.render(host.value, {
      sitekey: turnstileSiteKey(),
      // Turnstile exposes no colour tokens, only this enum. The app palette is
      // dark at the root (`--bg-color` and friends in app/main.scss), so `dark`
      // is the token-faithful choice — nothing here hardcodes a colour.
      theme: 'dark',
      callback: (value: string) => {
        token.value = value
      },
      'error-callback': clear,
      'expired-callback': clear,
      'timeout-callback': clear
    })
  })

  onBeforeUnmount(() => {
    if (widgetId) api?.remove(widgetId)
  })
</script>

<style scoped lang="scss">
  .turnstile {
    display: flex;
    flex-direction: column;
    gap: 4px;

    &__host {
      // Turnstile's standard widget is 300x65; reserving the box keeps the
      // submit button from jumping when the iframe finally paints.
      min-height: 65px;
    }
  }
</style>
