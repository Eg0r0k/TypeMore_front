/// <reference types="vite/client" />
/// <reference types="unplugin-icons/types/vue" />

interface ImportMetaEnv {
  /** Base URL of the Go backend API (e.g. http://localhost:8080/api/v1). */
  readonly VITE_API_URL: string
  /** Explicit realtime WebSocket endpoint (e.g. ws://localhost:8080/ws). Optional. */
  readonly VITE_WS_URL?: string
  /** Legacy alias some configs use for the API base; consulted after VITE_API_URL. */
  readonly VITE_API_BASE_URL?: string
  /** Truthy in Playwright E2E builds (enables the loopback match mode gate). */
  readonly VITE_E2E?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '@splidejs/vue-splide'
declare module '@splidejs/vue-splide/css/core'
