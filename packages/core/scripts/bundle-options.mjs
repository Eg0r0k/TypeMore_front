/**
 * The ONE definition of how the goja bundle is compiled — the successor of the
 * backend's `internal/replay/corejs/esbuild.args`, moved into the package so
 * the build, the determinism test and the export-parity test all consume the
 * same options object and cannot drift apart. (B11 was exactly that drift: a
 * bundle re-vendored from a stale second entry that had lost `normalize.ts`.)
 *
 * Flag rationale (see also TypeMore_back/internal/replay/corejs/README.md):
 * - ONE entry: `src/index.ts`, the same file the ESM library is built from.
 *   There is deliberately no bundle-specific entry to rot.
 * - `iife` + `globalName`: goja has no module loader; the bundle must publish
 *   itself on the global object as `TypeMoreCore`.
 * - `es2017`: goja implements ES5.1 plus most of ES2015+; esbuild lowers the
 *   rest. Raise only after the backend's replay tests still pass.
 * - `platform: 'browser'`: resolves and inlines `neverthrow` (the core's only
 *   runtime dependency). Nothing DOM-specific exists to be pulled in — the
 *   purity scan guarantees that at the source level.
 * - `legalComments: 'none'`, no minify: the vendored artifact is code-reviewed
 *   as a diff; minification would destroy that.
 *
 * DETERMINISM CONTRACT: two builds from the same tree must be byte-identical
 * (`tests/bundle-determinism.test.ts`). Everything here is content-derived;
 * esbuild itself is pinned exactly in package.json. Builds must run with the
 * package directory as cwd — esbuild writes module paths into the output as
 * comments, so the working directory is part of the bytes.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Version string from package.json — baked into both artifacts via `define`. */
export const packageVersion = () =>
  JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).version

/** esbuild options for the goja bundle. `outfile` is the caller's to add. */
export const gojaBundleOptions = () => ({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'TypeMoreCore',
  target: 'es2017',
  platform: 'browser',
  legalComments: 'none',
  charset: 'utf8',
  define: { __TYPEMORE_CORE_VERSION__: JSON.stringify(packageVersion()) },
  absWorkingDir: packageRoot
})
