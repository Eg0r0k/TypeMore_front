<template>
  <div class="board-view">
    <BoardControls :can-jump-to-self="state === 'ranked'" @top="toTop" @me="toSelf" />
    <BoardSelfRow
      v-if="state !== 'hidden'"
      :state="state"
      :entry="ownEntry"
      :entries-total="entriesTotal"
    />
    <BoardTable ref="table" :bucket="bucket" :self-user-id="selfUserId" />
  </div>
</template>

<script setup lang="ts">
  import { toRef, useTemplateRef } from 'vue'
  import { BoardControls } from '../controls'
  import { BoardSelfRow } from '../self-row'
  import { BoardTable } from '../board-table'
  import { useOwnRank } from '../model/use-own-rank'

  /**
   * One board: the controls strip, the caller's own standing pinned above the
   * ranking it belongs to, and the ranking itself.
   *
   * These travel together because they answer the same question about the
   * same bucket, and because the ranking needs the caller's `userId` to mark
   * their row. Mounted only once a bucket is chosen, which is what keeps
   * `useOwnRank` free of an "ask about no board" case.
   *
   * The RAIL deliberately stays outside this component: a board that fails to
   * load must not take the means of choosing another one with it.
   */
  const props = defineProps<{
    bucket: string
    /** The bucket's visible entry count from the catalogue, for the percentile. */
    entriesTotal?: number
  }>()

  const { ownEntry, state, selfUserId } = useOwnRank(toRef(props, 'bucket'))

  const table = useTemplateRef('table')

  const toTop = (): void => {
    table.value?.scrollToTop()
  }

  /**
   * Jump to my row when it is among the loaded pages. (Fetching a window
   * around an unloaded self is the `around=me` read — wired where the feed
   * learns to hold disjoint segments.)
   */
  const toSelf = (): void => {
    const id = selfUserId.value
    if (id === undefined) return
    table.value?.scrollToUser(id)
  }
</script>

<style lang="scss" scoped>
  .board-view {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }
</style>
