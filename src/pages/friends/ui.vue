<template>
  <div class="friends-page">
    <div class="friends-page__head">
      <Typography class="friends-page__title" color="primary" size="xxl" tag-name="h1">
        {{ t('friends.title.lead') }}
        <Typography tag-name="span" size="xxl" color="main">
          {{ t('friends.title.name') }}
        </Typography>
      </Typography>
    </div>

    <div class="friends-page__body">
      <section class="friends-page__panel" :aria-label="t('friends.find')">
        <Typography tag-name="h2" size="m" color="primary">{{ t('friends.find') }}</Typography>
        <PlayerSearch />
      </section>

      <!--
        The list half, and it is honest rather than absent. A tab called
        Friends with nothing but a search box reads as broken; a tab that says
        what is missing reads as unfinished, which is what it is. No "add
        friend" control exists anywhere on this page, because there is no
        endpoint behind one — a button that cannot work is worse than no button.
      -->
      <section class="friends-page__panel" :aria-label="t('friends.list.label')">
        <Typography tag-name="h2" size="m" color="primary">
          {{ t('friends.list.label') }}
        </Typography>
        <div class="friends-page__soon" data-testid="friends-list-placeholder">
          <IconUsers class="friends-page__soon-icon size-8" aria-hidden="true" />
          <Typography size="s" color="sub">{{ t('friends.list.soon') }}</Typography>
          <Typography size="xs" color="sub">{{ t('friends.list.meanwhile') }}</Typography>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'

  import { Typography } from '@/shared/ui/typography'
  import { PlayerSearch } from '@/features/friends/player-search'
  import IconUsers from '~icons/tabler/users'

  /**
   * Friends. One working half today — finding a player by name and opening
   * their public profile — because the friendship itself exists on neither
   * side of the wire yet: `GET /users?q=` is implemented, and there is no
   * route to follow a hit with.
   *
   * The page is laid out for both halves from the start, so the list arriving
   * later is a filled panel rather than a re-designed page.
   */
  const { t } = useI18n()
</script>

<style scoped lang="scss">
  .friends-page {
    // As a grid item of the shell's #main this must be allowed to shrink —
    // `min-width: auto` would size it to its content's min-content and clip at
    // phone widths (the same trap /profile and /servers document). The cap
    // keeps a scanning list at a readable measure instead of strewing it
    // across the full 1440.
    width: 100%;
    min-width: 0;
    margin-inline: auto;
    padding-block: 1.5rem;
  }

  .friends-page__head {
    margin-block-end: 1.5rem;
  }

  .friends-page__body {
    display: grid;
    gap: 1.5rem;
    align-items: start;
    grid-template-columns: 1fr;

    @media screen and (width >= 900px) {
      grid-template-columns: 3fr 2fr;
    }
  }

  .friends-page__panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }

  .friends-page__soon {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    text-align: center;
    border: 1px dashed var(--sub-color);
    border-radius: var(--roundness, 0.5rem);
  }

  .friends-page__soon-icon {
    color: var(--sub-color);
  }
</style>
