<template>
  <div class="stage">
    <div class="stage__above">
      <slot name="above" />
    </div>

    <div class="stage__field">
      <slot />
    </div>

    <div class="stage__below">
      <slot name="below" />
    </div>
  </div>
</template>

<script lang="ts" setup>
  /**
   * The typing screen — monkeytype's `#typingTest`: a band above the words, the
   * words, a band below them, and NOTHING in it may move the words.
   *
   * Every row is a FIXED height (`--tm-stage-above` / `--tm-stage-field` /
   * `--tm-stage-below`), so the stage's total height is a constant. That is the
   * whole design: the chrome above the field swaps constantly — settings bar out,
   * score HUD in, a loading notice where the words go, an explanation appearing
   * under the mods — and every one of those is a different height. With rows that
   * size to their content, each swap drags the words under the reader's eyes;
   * with fixed rows, nothing inside a band can reach outside it.
   *
   * Content that outgrows its band overflows rather than pushing: overflowing is
   * visible and ugly, moving the words is worse. Tune the reserve per breakpoint
   * (the caller sets the variables) instead of letting the grid do it silently.
   *
   * Each band is a column anchored TOWARDS the field (`above` piles upward from
   * the bottom, `below` grows downward from the top), so slot content stays put
   * against the words as siblings are added or removed around it.
   *
   * The results screen is deliberately NOT a stage slot: it is a page of its own
   * shape, and rendering it in the field row would make the row's height depend
   * on a chart. The page swaps the whole stage out for it, exactly as monkeytype
   * hides `#typingTest` to show `#result`.
   */
</script>

<style lang="scss" scoped>
  .stage {
    display: grid;
    grid-template-areas:
      'above'
      'field'
      'below';
    grid-template-rows:
      var(--tm-stage-above, 7.5rem)
      var(--tm-stage-field, 10rem)
      var(--tm-stage-below, 3rem);

    // Clear of the field's own out-of-flow chrome: the focus hint sits 1.75rem
    // above the first word.
    row-gap: 2rem;
    align-content: center;
    min-height: 60vh;
    padding-block: 2rem;

    &__above,
    &__below {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      align-items: center;
      width: 100%;
      min-height: 0;
    }

    &__above {
      grid-area: above;
      justify-content: flex-end;
    }

    &__field {
      display: grid;
      grid-area: field;
      align-content: center;
      width: 100%;
      min-height: 0;
    }

    &__below {
      grid-area: below;
      justify-content: flex-start;
    }
  }
</style>
