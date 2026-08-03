<template>
  <!--
    The header's own skeleton: the SAME geometry the loaded header has (banner
    height, avatar size and overlap, the 8/24px rhythm), so the page does not
    jump when the summary arrives. Aria-hidden — a skeleton is a placeholder,
    not a status; the section it lives in announces the load.
  -->
  <div
    class="relative flex animate-pulse flex-col"
    aria-hidden="true"
    data-testid="profile-identity-skeleton"
  >
    <div class="h-24 rounded-t-[6px] bg-sub-alt sm:h-36" />

    <div class="-mt-8 w-fit rounded-full ring-4 ring-bg sm:-mt-12">
      <div class="size-16 rounded-full bg-sub-alt sm:size-24" />
    </div>

    <!-- Nick, at the height of the 22/28px line it stands in for. -->
    <div class="mt-2 h-[26px] w-40 rounded-[6px] bg-sub-alt sm:h-[34px] sm:w-56" />
    <!-- Meta line. -->
    <div class="mt-2 h-5 w-64 max-w-full rounded-[6px] bg-sub-alt" />

    <!-- Counters. -->
    <div class="mt-6 flex flex-wrap gap-x-6 gap-y-2">
      <div v-for="n in 3" :key="n" class="h-6 w-24 rounded-[6px] bg-sub-alt" />
    </div>

    <!-- Language chips. -->
    <div class="mt-6 flex flex-wrap gap-2">
      <div v-for="n in 4" :key="n" class="h-6 w-20 rounded-[6px] bg-sub-alt" />
    </div>

    <div class="mt-6 border-t border-sub-alt" />
  </div>
</template>

<script setup lang="ts">
  /**
   * Mirrors `identity.vue`. No props: the header has one shape now — the only
   * thing an own page adds is that the avatar is clickable, which reserves no
   * space of its own.
   */
</script>
