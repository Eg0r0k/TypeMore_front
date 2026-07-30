/**
 * Per-run event-log version choice (log v2 keystroke telemetry).
 *
 * The version is decided ONCE, at log start, by capability detection — and the
 * heuristic is deliberately CONSERVATIVE: telemetry is only worth capturing
 * where a physical keyboard produces meaningful `KeyboardEvent.code` streams,
 * and a v1 log is accepted forever, so the cost of a false negative is only
 * missing telemetry, while a false positive (v2 from a virtual keyboard / IME
 * surface) would record half-noise. A client emits v2 only when EVERY signal
 * says "desktop with a physical keyboard":
 *
 *   - no touch points advertised (`navigator.maxTouchPoints === 0`) — touch
 *     laptops are deliberately demoted to v1 rather than risk on-screen input;
 *   - no mobile marker in the user agent;
 *   - a fine primary pointer (`matchMedia('(pointer: fine)')`).
 *
 * Anything unknown (jsdom/tests, exotic embedders, missing `matchMedia`) falls
 * back to v1. Composition sessions additionally suppress capture at the
 * adapter level even on a v2 run — see features/test/input.
 */
import { EVENT_LOG_VERSION, EVENT_LOG_VERSION_TELEMETRY, type EventLogVersion } from '@typemore/core'

const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i

export function detectLogVersion(): EventLogVersion {
  try {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') {
      return EVENT_LOG_VERSION
    }
    if ((navigator.maxTouchPoints ?? 0) > 0) return EVENT_LOG_VERSION
    if (MOBILE_UA.test(navigator.userAgent ?? '')) return EVENT_LOG_VERSION
    if (typeof window.matchMedia !== 'function') return EVENT_LOG_VERSION
    // BOTH answers must be coherent: a fine pointer AND no coarse one. A stub
    // environment that answers "yes" to every query (happy-dom, some webviews)
    // contradicts itself here and demotes to v1 — conservative by construction.
    if (!window.matchMedia('(pointer: fine)').matches) return EVENT_LOG_VERSION
    if (window.matchMedia('(pointer: coarse)').matches) return EVENT_LOG_VERSION
    return EVENT_LOG_VERSION_TELEMETRY
  } catch {
    return EVENT_LOG_VERSION
  }
}
