import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { boardsRoutes } from '@/app/router/routes/boards'
import { useRaceStore } from '@entities/race'

/**
 * /race/{id} after the rework (C10): a THIN route-level redirect — it arms the
 * race state and lands on home, so deep links from the boards keep working
 * while the standalone page's game surface is gone (there is no component to
 * render at all).
 */
describe('/race/{runId} — the thin redirect', () => {
  it('arms the race and resolves to home', async () => {
    setActivePinia(createPinia())
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div />' } },
        ...boardsRoutes.filter((route) => route.name === 'race')
      ]
    })
    await router.push('/race/run-ada')
    await router.isReady()

    const race = useRaceStore()
    expect(race.requestedRunId).toBe('run-ada')
    expect(router.currentRoute.value.name).toBe('home')
  })
})
