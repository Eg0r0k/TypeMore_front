<template>
  <div
    class="flex flex-col gap-3 rounded-lg bg-sub-alt p-3 [--pf-cell:10px] [--pf-gap:2px] sm:p-4 sm:[--pf-cell:12px] md:[--pf-cell:13px] lg:[--pf-cell:17px] lg:[--pf-gap:3px]"
    data-testid="profile-activity"
  >
    <!-- Left: how much there is in total. Right: what the shades mean. -->
    <header class="flex flex-wrap items-center justify-between gap-2">
      <Typography size="xs" color="sub" data-testid="profile-activity-total">
        {{ t('profile.activity.total', { tests: grouped(totalTests) }, totalTests) }}
      </Typography>

      <div
        class="flex items-center gap-1.5 text-[11px] text-sub"
        data-testid="profile-activity-legend"
      >
        <span>{{ t('profile.activity.less') }}</span>
        <span
          v-for="level in LEVELS"
          :key="level"
          class="size-[var(--pf-cell)] rounded-[2px] bg-[var(--pf-fill)]"
          :style="{ '--pf-fill': LEVEL_FILLS[level] }"
        />
        <span>{{ t('profile.activity.more') }}</span>
      </div>
    </header>

    <div v-if="empty" class="rounded bg-bg px-4 py-3" data-testid="profile-activity-empty">
      <Typography size="s" color="sub">{{ t('profile.activity.empty') }}</Typography>
    </div>

    <!-- The calendar itself: centred while it fits, scrollable once it does not
         (an over-constrained auto margin resolves to 0, so the left edge is
         never clipped inside the scroller). -->
    <TooltipProvider v-else :delay-duration="150">
      <div class="overflow-x-auto pb-1">
        <div class="mx-auto flex w-max gap-1.5">
          <!-- Weekday rail, Monday first, aligned cell-for-cell with the grid. -->
          <div
            class="flex shrink-0 flex-col gap-[var(--pf-gap)] text-right text-[calc(var(--pf-cell)*0.74)] leading-[var(--pf-cell)] text-sub"
            aria-hidden="true"
          >
            <span v-for="label in weekdayLabels" :key="label" class="h-[var(--pf-cell)]">
              {{ label }}
            </span>
          </div>

          <div class="flex gap-[var(--pf-gap)]" role="img" :aria-label="t('profile.activity.aria')">
            <div v-for="(week, w) in weeks" :key="w" class="flex flex-col gap-[var(--pf-gap)]">
              <template v-for="day in week" :key="day.date">
                <Tooltip v-if="day.inRange">
                  <TooltipTrigger as-child>
                    <!-- Today wears a RING (a box-shadow under the hood), never
                         a border: a border would add width and shove the whole
                         column off the grid the other 365 cells share. -->
                    <span
                      class="size-[var(--pf-cell)] rounded-[2px] bg-[var(--pf-fill)]"
                      :class="day.date === today ? 'ring-2 ring-text' : ''"
                      :style="{ '--pf-fill': LEVEL_FILLS[day.level] }"
                      :data-date="day.date"
                      :data-today="day.date === today ? 'true' : undefined"
                      :data-testid="day.tests > 0 ? 'profile-activity-day' : undefined"
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <span class="tabular-nums">
                      {{ day.date }} —
                      {{ t('profile.activity.tooltip', { tests: day.tests }, day.tests) }}
                    </span>
                  </TooltipContent>
                </Tooltip>
                <span v-else class="size-[var(--pf-cell)]" />
              </template>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'

  import type { ProfileActivity } from '@shared/api'
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
  import { Typography } from '@/shared/ui/typography'
  import { grouped, isoDay } from '../model/format'

  /**
   * The GitHub-style activity calendar: 366 UTC day cells in Monday-first week
   * columns, levels from the day's test count, a per-day tooltip, the total on
   * the left of the header and the shade scale on its right. A day is "played"
   * iff at least one run was SUBMITTED that day — logins are not tracked, by
   * design (backend docs/PROFILE.md). The streak line lives on the summary
   * card, under the join date.
   */
  const props = defineProps<{ activity: ProfileActivity }>()
  const { t, locale } = useI18n()

  const DAYS = 366
  const LEVELS = [0, 1, 2, 3, 4] as const

  /**
   * The shade per level, mixed from the theme's accent so a theme switch
   * repaints the calendar with zero JS.
   */
  const LEVEL_FILLS: Record<number, string> = {
    0: 'var(--bg-color)',
    1: 'color-mix(in srgb, var(--main-color) 30%, var(--bg-color))',
    2: 'color-mix(in srgb, var(--main-color) 55%, var(--bg-color))',
    3: 'color-mix(in srgb, var(--main-color) 80%, var(--bg-color))',
    4: 'var(--main-color)'
  }

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

  /** Today's own cell, marked so the eye finds "now" on a year of squares. */
  const today = isoDay(new Date())

  const empty = computed(() => props.activity.days.length === 0)
  const totalTests = computed(() => props.activity.days.reduce((sum, day) => sum + day.tests, 0))

  /** Monday-first weekday names in the UI locale ("mon", "вт", …). */
  const weekdayLabels = computed(() => {
    const format = new Intl.DateTimeFormat(locale.value, { weekday: 'short', timeZone: 'UTC' })
    // 2024-01-01 is a Monday — the anchor the rail is built from.
    return Array.from({ length: 7 }, (_, i) =>
      format.format(new Date(Date.UTC(2024, 0, 1 + i))).toLowerCase()
    )
  })

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
    // Align the first column to the MONDAY of the week containing the first day
    // (getUTCDay is Sunday-first, hence the rotation).
    const lead = (start.getUTCDay() + 6) % 7
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
