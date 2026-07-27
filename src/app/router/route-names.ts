// Compatibility shim: the names live in shared/router now, so features and
// pages can navigate without importing from the app layer. This re-export
// stays for the frozen zones (replay path, presentational room/results/boards)
// and the tests that address the old path — re-route them when they unfreeze.
export { ROUTE_NAMES, type AppRouteName } from '@/shared/router'
