<template>
  <div class="auth-page">
    <section class="auth-card">
      <header class="auth-card__head">
        <Typography class="auth-card__title" tag-name="h1" size="l" color="primary">
          {{ title }}
        </Typography>
        <Typography v-if="subtitle" tag-name="p" size="xs" color="sub">
          {{ subtitle }}
        </Typography>
      </header>

      <div class="auth-card__body">
        <slot />
      </div>

      <footer v-if="$slots.footer" class="auth-card__foot">
        <slot name="footer" />
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
  import { Typography } from '@/shared/ui/typography'

  /**
   * The one card every /login, /register, /reset, /reset/confirm, /verify and
   * /auth/callback page sits in.
   *
   * Each of those six pages used to carry its OWN copy of the same `.auth` SCSS
   * block, and the copies had drifted: two centred their text and four did not,
   * two declared spacing rules the others were missing, and the heading sizes
   * and gaps could only agree by coincidence. Consistency across a flow cannot
   * be maintained by six independent stylesheets — so there is now one.
   *
   * Two decisions worth naming:
   *
   *   - The card is anchored to the TOP of the page, not centred in it. Centring
   *     meant a taller form pushed the heading up: /login's title sat 40px above
   *     /register's, so following "create one" made the whole page jump. Anchored,
   *     the title is at the same y on every step of the flow.
   *   - The heading is text-coloured, not `main`. A blue heading over a blue
   *     submit button and blue links gave three things equal weight and left no
   *     obvious primary action; with the heading in text colour, the only blue
   *     above the fold is the button you are meant to press.
   *
   * It is also the page's `h1`. These pages had no h1 at all — the title was an
   * `h2` under nothing.
   */
  defineProps<{ title: string; subtitle?: string }>()
</script>

<style scoped lang="scss">
  .auth-page {
    display: flex;
    justify-content: center;

    // Anchored, not centred: see the note above.
    padding: clamp(24px, 8vh, 72px) 16px 48px;
  }

  .auth-card {
    display: flex;
    flex-direction: column;

    // The block rhythm: 28px between head, body and footer; every gap inside
    // them is smaller than this, so the three read as three groups.
    gap: 28px;
    width: min(400px, 100%);
  }

  .auth-card__head {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .auth-card__body {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  // Separated by the hairline the app uses everywhere else: the ways OUT of this
  // page are not part of the form above them.
  .auth-card__foot {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    padding-top: 20px;
    border-top: 1px solid var(--sub-alt-color);
  }
</style>
