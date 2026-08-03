<template>
  <!--
    DEV-ONLY badge. Mounted from App.vue behind an `import.meta.env.DEV`
    branch, and visible only on the two pages it previews — everywhere else it
    would be furniture in the way of ordinary development.

    Deliberately un-translated and outside the design system's components: it is
    a tool, not a surface, and nothing here should ever end up in a locale file
    or in a snapshot of the real UI.
  -->
  <aside v-if="onPreviewablePage" class="dev-preview" :class="{ 'dev-preview--open': open }">
    <button type="button" class="dev-preview__toggle" :aria-expanded="open" @click="open = !open">
      ◆ preview: {{ scenario ?? 'off' }}
    </button>

    <div v-if="open" class="dev-preview__panel">
      <div class="dev-preview__row">
        <button
          v-for="option in PREVIEW_SCENARIOS"
          :key="option"
          type="button"
          class="dev-preview__chip"
          :class="{ 'dev-preview__chip--on': option === scenario }"
          :title="DESCRIPTIONS[option]"
          @click="apply(option)"
        >
          {{ option }}
        </button>
        <button
          type="button"
          class="dev-preview__chip"
          :class="{ 'dev-preview__chip--on': scenario === null }"
          title="Off — the real API answers again"
          @click="apply(null)"
        >
          off
        </button>
      </div>

      <div class="dev-preview__row">
        <button type="button" class="dev-preview__chip" @click="go(routeLocation.profile())">
          /profile
        </button>
        <button
          type="button"
          class="dev-preview__chip"
          title="Your own public page — the owner's view, even when closed"
          @click="go(routeLocation.user(PREVIEW_ME))"
        >
          /u/{{ PREVIEW_ME }}
        </button>
        <button
          type="button"
          class="dev-preview__chip"
          title="Somebody else's page — a stranger's view"
          @click="go(routeLocation.user(PREVIEW_OTHER))"
        >
          /u/{{ PREVIEW_OTHER }}
        </button>
      </div>

      <p class="dev-preview__hint">{{ scenario === null ? HINT_OFF : DESCRIPTIONS[scenario] }}</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import type { RouteLocationRaw } from 'vue-router'

  import { ROUTE_NAMES, routeLocation } from '@/shared/router'
  import {
    PREVIEW_ME,
    PREVIEW_OTHER,
    PREVIEW_SCENARIOS,
    previewScenario,
    setPreviewScenario,
    type PreviewScenario
  } from './scenario'

  const route = useRoute()
  const router = useRouter()

  const open = ref(false)
  const scenario = computed<PreviewScenario | null>(() => {
    // Re-read on every navigation: `?preview=` in the URL is the other switch.
    void route.fullPath
    return previewScenario()
  })

  const onPreviewablePage = computed(
    () => route.name === ROUTE_NAMES.PROFILE || route.name === ROUTE_NAMES.USER
  )

  const DESCRIPTIONS: Record<PreviewScenario, string> = {
    full: 'A lived-in account: every section populated.',
    empty: 'A fresh account: zeroes and empty states.',
    stress: 'The worst case: a 24-character name, 12 languages, five-digit counts.',
    closed: 'A closed profile — /u refuses every section (403). Your own page still opens.',
    portrait: 'Open profile, private keyboard portrait (403 on /u only).',
    missing: '/u of a name nobody has — the 404 state.',
    error: 'Every aggregate fails: the section error chrome and its retry.',
    guest: 'No session — /profile shows its sign-in hint.'
  }
  const HINT_OFF = 'Off — the real API answers. Pick a scenario to preview without a backend.'

  /**
   * A scenario switch RELOADS. `/me` resolves once per page load and the auth
   * store is derived from it, so `guest` (and coming back from it) is only
   * honest after a fresh boot.
   */
  const apply = (next: PreviewScenario | null): void => {
    setPreviewScenario(next)
    const url = new URL(globalThis.location.href)
    url.searchParams.delete('preview')
    globalThis.location.replace(url.toString())
  }

  const go = (to: RouteLocationRaw): void => void router.push(to)
</script>

<style lang="scss" scoped>
  .dev-preview {
    position: fixed;
    bottom: 0.75rem;
    left: 0.75rem;

    // Under the alerts and modals, above the page: a tool must never sit on
    // top of the thing it is there to look at.
    z-index: 900;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    align-items: flex-start;
    max-width: min(30rem, calc(100vw - 1.5rem));
    font-family: monospace;
    font-size: 0.6875rem;
  }

  .dev-preview__toggle {
    padding: 0.25rem 0.5rem;
    color: var(--bg-color);
    background: var(--main-color);
    border-radius: 0.25rem;
    opacity: 0.55;
    transition: opacity 0.12s;

    &:hover,
    &:focus-visible {
      opacity: 1;
    }
  }

  .dev-preview--open .dev-preview__toggle {
    opacity: 1;
  }

  .dev-preview__panel {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.5rem;
    background: var(--sub-alt-color);
    border-radius: 0.375rem;
  }

  .dev-preview__row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .dev-preview__chip {
    padding: 0.125rem 0.375rem;
    color: var(--sub-color);
    background: var(--bg-color);
    border-radius: 0.25rem;

    &:hover,
    &:focus-visible {
      color: var(--text-color);
    }
  }

  .dev-preview__chip--on {
    color: var(--bg-color);
    background: var(--main-color);
  }

  .dev-preview__hint {
    max-width: 24rem;
    color: var(--sub-color);
  }
</style>
