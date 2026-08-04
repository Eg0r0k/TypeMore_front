<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="w-full max-h-[calc(100vh-4rem)] gap-0 overflow-hidden p-0 sm:max-w-[920px]"
      :aria-label="t('settings.title')"
    >
      <DialogHeader class="sr-only">
        <DialogTitle>{{ t('settings.title') }}</DialogTitle>
        <DialogDescription>{{ t('settings.search') }}</DialogDescription>
      </DialogHeader>

      <div class="settings-dialog">
        <aside class="settings-dialog__nav">
          <div class="settings-dialog__search">
            <div class="relative">
              <IconSearch class="absolute top-1/2 left-5 -translate-1/2 pointer-events-none" />
              <Input
                v-model="query"
                class="pl-10 bg-background"
                :placeholder="t('settings.search')"
              />
            </div>
          </div>

          <nav class="settings-dialog__tabs" :aria-label="t('settings.title')">
            <button
              v-for="category in CATEGORIES"
              :key="category.id"
              type="button"
              class="settings-dialog__tab"
              :class="{ 'settings-dialog__tab--active': category.id === activeCategory }"
              :aria-current="category.id === activeCategory ? 'true' : undefined"
              @click="selectCategory(category.id)"
            >
              <component
                :is="category.icon"
                class="settings-dialog__icon size-5"
                aria-hidden="true"
              />
              <span>{{ t(`settings.category.${category.id}`) }}</span>
            </button>
          </nav>
        </aside>

        <section class="settings-dialog__pane bg-background">
          <!--
            A real heading, and the reason the pane can have a normal right
            padding: the dialog's close button is pinned to the content's
            top-right corner, so SOMETHING has to yield that corner. It used to
            be paid for with a 48px right gutter on the whole pane, which pulled
            every control off the edge it was supposed to align to. Now the
            heading row yields it once, and the scrolling body below is padded
            evenly. Kept outside the scroller so it cannot slide under the button.
          -->
          <header class="settings-dialog__head">
            <Typography size="m" color="primary" tag-name="h2">
              {{ searching ? t('settings.title') : t(`settings.category.${activeCategory}`) }}
            </Typography>
          </header>

          <div class="settings-dialog__body">
            <template v-if="visibleCategories.length">
              <div
                v-for="category in visibleCategories"
                :key="category"
                class="settings-dialog__group"
              >
                <Typography
                  v-if="searching"
                  size="s"
                  color="main"
                  tag-name="p"
                  class="settings-dialog__group-title"
                >
                  {{ t(`settings.category.${category}`) }}
                </Typography>

                <InputSection v-if="category === 'input'" />
                <SoundSection v-else-if="category === 'sound'" />
                <CaretSection v-else-if="category === 'caret'" />
                <!-- Appearance owns the theme rows too: one "how it looks" tab. -->
                <template v-else-if="category === 'appearance'">
                  <AppearanceSection />
                  <ThemeSection />
                </template>
                <!-- Account owns both the profile editor and the privacy
                     switches: both exist only once there is an account, and
                     both are about the same page. They are ONE branch of this
                     chain — a second `v-if` between the arms detaches the
                     `v-else` below, and the danger zone then renders under
                     every tab. -->
                <template v-else-if="category === 'account'">
                  <ProfileSection />
                  <AccountSection />
                </template>
                <DangerSection v-else />
              </div>
            </template>

            <Typography v-else size="m" color="sub" tag-name="p">
              {{ t('settings.empty', { query }) }}
            </Typography>
          </div>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
  import { computed, provide, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import IconSearch from '~icons/tabler/search'

  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
  } from '@/shared/ui/dialog'
  import { SearchBar } from '@/shared/ui/search'
  import { Typography } from '@/shared/ui/typography'
  import { useDialogsStore } from '@/entities/dialogs'
  import {
    CATEGORIES,
    SETTINGS,
    SETTINGS_FILTER,
    SETTINGS_NAV,
    type CategoryId,
    type SettingId
  } from './model/registry'
  import AccountSection from './parts/AccountSection.vue'
  import ProfileSection from './parts/ProfileSection.vue'
  import AppearanceSection from './parts/AppearanceSection.vue'
  import CaretSection from './parts/CaretSection.vue'
  import DangerSection from './parts/DangerSection.vue'
  import InputSection from './parts/InputSection.vue'
  import SoundSection from './parts/SoundSection.vue'
  import ThemeSection from './parts/ThemeSection.vue'
  import { Input } from '@/shared/ui/input/index.ts'

  /**
   * Settings live in a dialog, not on a page: they are always adjusted next to
   * the thing they change (the test), and the route we used to have made you
   * leave it. Category column + search on the left, one category at a time on
   * the right; below `md` the column collapses into a horizontal label strip
   * (no icons, no search — there is no room for either on a phone).
   *
   * Search is cross-category: while a query is active the pane lists every
   * matching row under its category heading, and the left column is only a
   * shortcut back to browsing.
   */
  const open = defineModel<boolean>('open', { required: true })

  const { t } = useI18n()

  const query = ref('')
  const activeCategory = ref<CategoryId>('input')

  const searching = computed(() => query.value.trim().length > 0)

  /** Match the query against what the user actually reads: label + description. */
  const matchedIds = computed<Set<SettingId>>(() => {
    const needle = query.value.trim().toLowerCase()
    if (!needle) return new Set(SETTINGS.map((setting) => setting.id))
    return new Set(
      SETTINGS.filter((setting) => {
        const haystack = [
          t(`settings.${setting.id}.label`),
          t(`settings.${setting.id}.description`),
          ...(setting.keywords ?? [])
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(needle)
      }).map((setting) => setting.id)
    )
  })

  const visibleCategories = computed<CategoryId[]>(() => {
    if (!searching.value) return [activeCategory.value]
    return CATEGORIES.map((category) => category.id).filter((id) =>
      SETTINGS.some((setting) => setting.category === id && matchedIds.value.has(setting.id))
    )
  })

  const selectCategory = (id: CategoryId): void => {
    activeCategory.value = id
    query.value = ''
  }

  /**
   * Drill-down: the theme and cookie dialogs are mounted once in App.vue, and
   * the store owns both the flags and the come-back (it is a relationship
   * between dialogs, not a fact about this one). Stacking two reka dialogs
   * shares one dismiss chain — closing the inner one dragged this one down
   * with it, which is what the drill-down avoids.
   */
  const dialogs = useDialogsStore()

  /**
   * Deep-link into a tab: `openSettings('account')` from the profile avatar
   * lands here instead of on whatever tab the dialog was last left on.
   *
   * Both flags are watched together because `openSettings` writes them in the
   * same tick — watching `open` alone would read the category before it was
   * set on the very first open. The request is CONSUMED (cleared) once applied,
   * which is what lets the theme/cookie drill-down come back to the tab you
   * actually left rather than to the one you originally arrived on.
   */
  watch(
    [open, () => dialogs.settingsCategory],
    ([isOpen, requested]) => {
      if (!isOpen || !requested) return
      selectCategory(requested)
      dialogs.settingsCategory = null
    },
    { immediate: true }
  )

  provide(SETTINGS_FILTER, { isVisible: (id: SettingId) => matchedIds.value.has(id) })
  provide(SETTINGS_NAV, {
    openThemes: () => dialogs.openThemes(),
    openCookies: () => dialogs.openCookies()
  })
</script>

<style lang="scss" scoped>
  .settings-dialog {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    width: 100%;
    height: min(640px, calc(100vh - 6rem));
    min-height: 0;

    @media (width >= 768px) {
      grid-template-rows: minmax(0, 1fr);
      grid-template-columns: 220px minmax(0, 1fr);
    }
  }

  .settings-dialog__nav {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;

    // The dialog's close button sits at top-right; on the phone layout the tab
    // strip runs the full width and would slide underneath it.
    padding: 16px 48px 16px 16px;
    border-bottom: 1px solid var(--sub-color);

    @media (width >= 768px) {
      padding: 16px 14px 20px 14px;
      border-right: 1px solid var(--sub-color);
      border-bottom: 0;
    }
  }

  // No search on a phone: the strip below is the whole navigation.
  .settings-dialog__search {
    display: none;

    @media (width >= 768px) {
      display: block;
    }
  }

  .settings-dialog__tabs {
    display: flex;
    flex-direction: row;
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }

    @media (width >= 768px) {
      flex-direction: column;
      overflow-x: visible;
    }
  }

  .settings-dialog__tab {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 8px 12px;
    font-size: 15px;
    color: var(--sub-color);
    white-space: nowrap;
    cursor: pointer;
    background: none;
    border: 0;
    border-radius: var(--border-radius);
    transition:
      color 0.08s ease,
      background-color 0.08s ease;

    &:hover {
      color: var(--text-color);
    }

    &--active {
      color: var(--bg-color);
      background-color: var(--main-color);
    }
  }

  .settings-dialog__icon {
    display: none;
    flex-shrink: 0;

    @media (width >= 768px) {
      display: block;
    }
  }

  .settings-dialog__pane {
    /*
     * The control rail, declared ONCE for the whole pane: every SettingRow
     * resolves its control column to this width, which is what makes the
     * controls line up across rows AND across sections (appearance renders two
     * of them).
     */
    --setting-control-width: 220px;
    --settings-pane-gutter: 24px;

    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-width: 0;
  }

  // Right padding clears the dialog's close button; the body below does not
  // have to, which is the whole point of splitting them.
  .settings-dialog__head {
    padding: 18px 52px 12px var(--settings-pane-gutter);

    // The same hairline the rows separate themselves with, so it reads as the
    // top of that rhythm rather than added chrome — and it tells you where the
    // scrolling body starts, since a control clipped at an unmarked edge just
    // looks broken.
    border-bottom: 1px solid var(--sub-alt-color);
  }

  .settings-dialog__body {
    min-width: 0;
    padding: 4px var(--settings-pane-gutter) 24px;
    overflow-y: auto;
  }

  .settings-dialog__group-title {
    margin-top: 8px;
  }
</style>
