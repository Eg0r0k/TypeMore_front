<template>
  <!-- The tooltip is CONTROLLED, not hover-driven: it is the confirmation, so
       it has to appear on a click and leave on its own. `open` forces it up
       while `copied` holds; the rest of the time it behaves like every other
       tooltip in the app and explains the button on hover. -->
  <!-- Its own provider, for the same reason ProfileIdentity has one: the
       confirmation IS a tooltip, so the button cannot depend on the page
       having provided one. -->
  <TooltipProvider :delay-duration="80">
    <Tooltip :open="copied || undefined">
      <TooltipTrigger as-child>
        <Button
          color="shadow"
          size="icon-sm"
          :aria-label="t('profile.copyLink.label')"
          data-testid="profile-copy-link"
          @click="copy"
        >
          <IconCheck v-if="copied" class="size-4 text-main" data-testid="profile-copy-link-done" />
          <IconLink v-else class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" data-testid="profile-copy-link-tip">
        {{ copied ? t('profile.copyLink.copied') : t('profile.copyLink.label') }}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>

<script setup lang="ts">
  import { onUnmounted, shallowRef } from 'vue'
  import { useI18n } from 'vue-i18n'
  import IconLink from '~icons/tabler/link'
  import IconCheck from '~icons/tabler/check'
  import { useRouter } from 'vue-router'
  import { Button } from '@/shared/ui/button'
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
  import { routeLocation } from '@/shared/router'

  /**
   * "Copy this profile's link" — the canonical PUBLIC url, on the clipboard.
   *
   * The confirmation is the button's own tooltip rather than a toast, and that
   * is the point of the component: a toast puts the answer in the corner of the
   * screen, away from the thing that was clicked, for an action whose whole
   * scope is this one button. Here the answer appears on the control that
   * caused it and leaves by itself.
   *
   * No execCommand fallback. `navigator.clipboard` is available in every
   * browser this app supports under a secure context; a fallback would be dead
   * code kept alive for a case that never arrives, and `document.execCommand`
   * is deprecated. A genuine failure (an insecure context, a refused
   * permission) leaves the tooltip saying what the button does — the link is
   * still visible in the address bar, which is the honest outcome.
   */
  const props = defineProps<{
    /** The profile's display name — what the canonical url is built from. */
    name: string
  }>()

  const { t } = useI18n()
  const router = useRouter()

  const COPIED_MS = 1500
  const copied = shallowRef(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  /**
   * Built from the router's own location helper and `location.origin`, never
   * from `location.href`: the current url may carry a query (`?bucket=`) or be
   * the owner's `/profile` rather than the public page, and neither is the link
   * somebody wants pasted.
   */
  const canonicalUrl = (): string =>
    new URL(router.resolve(routeLocation.user(props.name)).href, window.location.origin).toString()

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(canonicalUrl())
    } catch {
      // Nothing to announce: the tooltip stays on its label, and the address
      // bar still holds the link.
      return
    }
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), COPIED_MS)
  }

  onUnmounted(() => clearTimeout(timer))
</script>
