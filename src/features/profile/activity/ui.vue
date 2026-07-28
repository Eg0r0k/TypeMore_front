<template>
  <div class="pf-activity" data-testid="profile-activity">
    <div v-if="empty" class="pf-activity__empty" data-testid="profile-activity-empty">
      <Typography size="s" color="sub">{{ t('profile.activity.empty') }}</Typography>
    </div>

    <TooltipProvider v-else :delay-duration="150">
      <div class="pf-activity__scroll">
        <div class="pf-activity__grid" role="img" :aria-label="t('profile.activity.aria')">
          <div v-for="(week, w) in weeks" :key="w" class="pf-activity__week">
            <template v-for="day in week" :key="day.date">
              <Tooltip v-if="day.inRange">
                <TooltipTrigger as-child>
                  <span
                    class="pf-activity__cell"
                    :class="`pf-activity__cell--l${day.level}`"
                    :data-date="day.date"
                    :data-testid="day.tests > 0 ? 'profile-activity-day' : undefined"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <span class="pf-activity__tip">
                    {{ day.date }} —
                    {{ t('profile.activity.tooltip', { tests: day.tests }, day.tests) }}
                  </span>
                </TooltipContent>
              </Tooltip>
              <span v-else class="pf-activity__cell pf-activity__cell--void" />
            </template>
          </div>
        </div>
      </div>
    </TooltipProvider>

    <!-- The streak line: playing, not logging in, is what counts (runs-based). -->
    <div class="pf-activity__streak" data-testid="profile-streak">
      <Typography size="xs" color="sub">
        {{ t('profile.activity.streak', { current: streak.current, best: streak.best }) }}
      </Typography>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'

  import type { ProfileActivity } from '@shared/api'
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
  import { Typography } from '@/shared/ui/typography'
  import { isoDay } from '../model/format'

  /**
   * The GitHub-style activity calendar: 366 UTC day cells in week columns,
   * levels from the day's test count, a per-day tooltip, and the streak line
   * underneath. A day is "played" iff at least one run was SUBMITTED that day —
   * logins are not tracked, by design (backend docs/PROFILE.md).
   */
  const props = defineProps<{
    activity: ProfileActivity
    streak: { current: number; best: number }
  }>()
  const { t } = useI18n()

  const DAYS = 366

  interface DayCell {
    date: string
    tests: number
    level: number
    inRange: boolean
  }

  const byDate = computed(() => {
    const map = new Map<string, number>()
    for (const day of props.activity.days) map.set(day.date, day.tests)
    return map
  })

  const empty = computed(() => props.activity.days.length === 0)

  /** Quartile-ish levels over the user's own peak — 1..4 for any played day. */
  const levelOf = (tests: number, max: number): number => {
    if (tests <= 0) return 0
    if (max <= 1) return 4
    return 1 + Math.min(3, Math.floor(((tests - 1) / max) * 4))
  }

  const weeks = computed<DayCell[][]>(() => {
    const max = Math.max(1, ...props.activity.days.map((d) => d.tests))
    const today = new Date()
    const start = new Date()
    start.setUTCDate(start.getUTCDate() - (DAYS - 1))
    // Align the first column to the week containing the first day.
    const lead = start.getUTCDay()
    const cells: DayCell[] = []
    for (let i = 0; i < lead; i++) {
      cells.push({ date: `lead-${i}`, tests: 0, level: 0, inRange: false })
    }
    const cursor = new Date(start)
    while (cursor <= today) {
      const date = isoDay(cursor)
      const tests = byDate.value.get(date) ?? 0
      cells.push({ date, tests, level: levelOf(tests, max), inRange: true })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    const out: DayCell[][] = []
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7))
    return out
  })
</script>

<style lang="scss" scoped>
  .pf-activity {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    &__scroll {
      overflow-x: auto;
      padding-bottom: 0.25rem;
    }

    &__grid {
      display: flex;
      gap: 3px;
      width: max-content;
    }

    &__week {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    &__cell {
      width: 11px;
      height: 11px;
      background-color: var(--bg-color);
      border-radius: 2px;

      &--void {
        background-color: transparent;
      }

      &--l1 {
        background-color: color-mix(in srgb, var(--main-color) 30%, var(--bg-color));
      }

      &--l2 {
        background-color: color-mix(in srgb, var(--main-color) 55%, var(--bg-color));
      }

      &--l3 {
        background-color: color-mix(in srgb, var(--main-color) 80%, var(--bg-color));
      }

      &--l4 {
        background-color: var(--main-color);
      }
    }

    &__tip {
      font-variant-numeric: tabular-nums;
    }

    &__empty {
      padding: 1rem;
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }
  }
</style>
