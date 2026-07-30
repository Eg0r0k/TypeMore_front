// @vitest-environment node
//
// Export parity: the goja bundle's runtime export set must be EXACTLY the
// runtime export set of src/index.ts — same names, nothing missing, nothing
// extra. This is the permanent tripwire for the B11 class of failure: a bundle
// re-vendored from a wrong or stale entry (the historical incident shipped a
// bundle silently missing normalize.ts) can not pass it, because the bundle
// under test is compiled HERE, from the same options object the real build
// uses (scripts/bundle-options.mjs), and compared against the index the app
// imports.
import vm from 'node:vm'

import { describe, expect, it } from 'vitest'
import { build } from 'esbuild'

// eslint-disable-next-line -- runtime import of the shared build options (plain .mjs, no types)
import { gojaBundleOptions } from '../scripts/bundle-options.mjs'

import * as index from '@typemore/core'

describe('goja bundle ≡ src/index.ts', () => {
  it('exports exactly the index export set', async () => {
    const result = await build({ ...gojaBundleOptions(), write: false })
    const code = result.outputFiles[0].text

    // The bundle is an IIFE assigning `var TypeMoreCore` — in a vm context the
    // top-level var lands on the sandbox object, same as on goja's global.
    const sandbox: Record<string, unknown> = {}
    vm.runInNewContext(code, sandbox, { filename: 'core.bundle.js' })
    const bundleGlobal = sandbox.TypeMoreCore as Record<string, unknown>
    expect(bundleGlobal, 'bundle did not define the TypeMoreCore global').toBeTypeOf('object')

    const bundleExports = Object.keys(bundleGlobal).sort()
    const indexExports = Object.keys(index).sort()

    // Byte-order-independent set equality, reported as two diffs so a failure
    // names the drifted symbols instead of dumping both lists.
    const missing = indexExports.filter((name) => !bundleExports.includes(name))
    const extra = bundleExports.filter((name) => !indexExports.includes(name))
    expect(missing, 'index exports missing from the bundle (wrong/stale entry?)').toEqual([])
    expect(extra, 'bundle exports not present in index (built from another entry?)').toEqual([])
  })

  it('the constants the server logs at load are present and coherent', async () => {
    const result = await build({ ...gojaBundleOptions(), write: false })
    const sandbox: Record<string, unknown> = {}
    vm.runInNewContext(result.outputFiles[0].text, sandbox)
    const core = sandbox.TypeMoreCore as Record<string, unknown>

    // The bundle build injects the real package version; the source fallback
    // (what THIS test file imported) stays the dev marker. Both facts matter:
    // the server must never log '0.0.0-dev' off a vendored bundle.
    expect(core.CORE_PACKAGE_VERSION).toBeTypeOf('string')
    expect(core.CORE_PACKAGE_VERSION).not.toBe('0.0.0-dev')
    expect(index.CORE_PACKAGE_VERSION).toBe('0.0.0-dev')

    expect(core.EVENT_LOG_VERSION).toBe(index.EVENT_LOG_VERSION)
    expect(core.EVENT_LOG_VERSION_TELEMETRY).toBe(index.EVENT_LOG_VERSION_TELEMETRY)
  })
})
