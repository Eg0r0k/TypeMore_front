/**
 * Tauri injects `__TAURI_INTERNALS__` into the webview before any app code runs,
 * so this can be a module-level constant rather than a reactive check. In a plain
 * browser it stays `false`, the titlebar never renders and `@tauri-apps/api` —
 * which is only ever reached through a dynamic import — is never fetched.
 */
export const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/*
 * Stamped on <html> so the global stylesheet can drop the DOCUMENT's scrollbar
 * for the desktop build. It cannot be done from a component: `html { overflow-y:
 * scroll }` is a page-level rule (a permanent gutter, so a short page and a long
 * one do not jump), and leaving it on in Tauri is what puts a second, dead
 * scrollbar beside the app's own — the window's chrome is the app's, so the
 * scrolling has to be the app's too.
 */
if (IS_TAURI) document.documentElement.classList.add('is-tauri')
