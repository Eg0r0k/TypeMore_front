<template>
  <div class="board-view">
    <BoardMyRank v-if="isOwnRankVisible" :entry="ownEntry" />
    <BoardTable :bucket="bucket" :self-user-id="selfUserId" />
  </div>
</template>

<script setup lang="ts">
  import { toRef } from 'vue'
  import { BoardMyRank } from '../my-rank'
  import { BoardTable } from '../board-table'
  import { useOwnRank } from '../model/use-own-rank'

  /**
   * One board: the caller's own standing above the ranking it belongs to.
   *
   * These two travel together because they answer the same question about the
   * same bucket, and because the ranking needs the caller's `userId` to mark
   * their row. Mounted only once a bucket is chosen, which is what keeps
   * `useOwnRank` free of an "ask about no board" case.
   *
   * The bucket PICKER deliberately stays above this component: a board that
   * fails to load must not take the means of choosing another one with it.
   */
  const props = defineProps<{ bucket: string }>()

  const { ownEntry, isOwnRankVisible, selfUserId } = useOwnRank(toRef(props, 'bucket'))
</script>

<style lang="scss" scoped>
  .board-view {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }
</style>
