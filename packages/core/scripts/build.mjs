/**
 * `pnpm --filter @typemore/core build` — the ONLY way either artifact is
 * produced. Both come from the single entry `src/index.ts`:
 *
 *   dist/index.js        ESM library (neverthrow stays external)
 *   dist/*.d.ts          declarations (tsc --emitDeclarationOnly)
 *   dist/core.bundle.js  self-contained IIFE for the server's goja runtime
 *
 * The bundle ends with a build-info trailer line:
 *
 *   //# typemore-core-build {"version":...,"eventLogVersion":...,"gitSha":...,"gitDirty":...}
 *
 * That line is machine-read in two places: the backend's `make core-bundle`
 * refuses to vendor a bundle whose gitDirty is true or whose gitSha is not the
 * frontend's current HEAD, and the backend's freshness gate strips it before
 * diffing so an unrelated frontend commit (new sha, identical core source)
 * does not read as a stale bundle. The log-version numbers in the trailer are
 * READ OUT OF THE COMPILED BUNDLE, never restated by hand — the exported
 * constants are the only source of truth, and the server logs them (with
 * CORE_PACKAGE_VERSION) next to the bundle SHA at startup.
 *
 * Deterministic by contract: same tree in, same bytes out — pinned esbuild,
 * content-derived inputs only, fixed cwd. `tests/bundle-determinism.test.ts`
 * holds this to byte equality.
 */
import { execFileSync, execSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'

import { build } from 'esbuild'

import { gojaBundleOptions, packageRoot, packageVersion } from './bundle-options.mjs'

const dist = join(packageRoot, 'dist')
mkdirSync(dist, { recursive: true })

const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: packageRoot, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

// Git state of the frontend checkout this bundle was built from. An unreadable
// git state must read as dirty, never as clean.
const gitSha = git('rev-parse', 'HEAD') || 'unknown'
const gitDirty = gitSha === 'unknown' ? true : git('status', '--porcelain') !== ''

// --- ESM library -----------------------------------------------------------
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2020',
  platform: 'neutral',
  packages: 'external',
  legalComments: 'none',
  charset: 'utf8',
  define: { __TYPEMORE_CORE_VERSION__: JSON.stringify(packageVersion()) },
  absWorkingDir: packageRoot,
  outfile: join(dist, 'index.js')
})

// --- declarations ----------------------------------------------------------
execSync('pnpm exec tsc -p tsconfig.build.json', { cwd: packageRoot, stdio: 'inherit' })

// --- goja bundle -----------------------------------------------------------
const outfile = join(dist, 'core.bundle.js')
await build({ ...gojaBundleOptions(), outfile })

// Read the wire-format constants back OUT of the artifact itself (the bundle
// is an IIFE assigning to `var TypeMoreCore`, which lands on the vm context),
// so the trailer can never disagree with the code above it.
const sandbox = {}
vm.runInNewContext(readFileSync(outfile, 'utf8'), sandbox, { filename: 'core.bundle.js' })
const core = sandbox.TypeMoreCore
if (typeof core?.EVENT_LOG_VERSION !== 'number' || typeof core?.CORE_PACKAGE_VERSION !== 'string') {
  throw new Error('built bundle does not expose EVENT_LOG_VERSION / CORE_PACKAGE_VERSION — wrong entry?')
}
if (core.CORE_PACKAGE_VERSION !== packageVersion()) {
  throw new Error(`bundle CORE_PACKAGE_VERSION ${core.CORE_PACKAGE_VERSION} != package.json ${packageVersion()}`)
}

// The trailer is read back from the FINISHED file by tooling, so it must be
// the last line and must stay one line of JSON.
const buildInfo = {
  version: core.CORE_PACKAGE_VERSION,
  eventLogVersion: core.EVENT_LOG_VERSION,
  telemetryLogVersion: core.EVENT_LOG_VERSION_TELEMETRY,
  gitSha,
  gitDirty
}
appendFileSync(outfile, `//# typemore-core-build ${JSON.stringify(buildInfo)}\n`)

console.log(
  `@typemore/core ${buildInfo.version} built: dist/index.js, dist/core.bundle.js ` +
    `(log v${buildInfo.eventLogVersion}/v${buildInfo.telemetryLogVersion}, ` +
    `git ${gitSha.slice(0, 12)}${gitDirty ? ' DIRTY' : ''})`
)
