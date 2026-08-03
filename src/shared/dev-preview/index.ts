/**
 * DEV-ONLY profile preview — `/profile` and `/u/{name}` against fixtures.
 *
 * See `scenario.ts` for what the flag is and how to turn it on; `handler.ts`
 * for where the fixtures enter (the transport boundary, so the pages run
 * unchanged); `docs/DEV-PREVIEW.md` for the walkthrough.
 *
 * Nothing outside `shared/api/transport.ts` (the handler) and `app/App.vue`
 * (the badge) imports this slice, and both do it from a DEV-guarded branch, so
 * a production build drops the whole thing.
 */

export { default as DevPreviewBadge } from './ui.vue'
export {
  PREVIEW_ME,
  PREVIEW_OTHER,
  PREVIEW_SCENARIOS,
  previewScenario,
  setPreviewScenario,
  type PreviewScenario
} from './scenario'
