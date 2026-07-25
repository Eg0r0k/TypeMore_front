/**
 * Real timer-worker factory. Isolated here so the `?worker` build transform (Vite)
 * lives outside `useGameTimer`, keeping that composable importable in plain tests.
 */
import TimerWorker from '@shared/core/timer.worker?worker'

import type { TimerWorkerLike } from './useGameTimer'

export const createTimerWorker = (): TimerWorkerLike => new TimerWorker()
