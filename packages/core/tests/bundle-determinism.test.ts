// @vitest-environment node
//
// Determinism: two bundle builds from the same tree must produce byte-identical
// output. The backend vendors this artifact and diffs it (freshness gate), and
// `make core-bundle` compares provenance by content — a non-deterministic build
// would turn both into noise.
//
// The compiled body is what is checked here. The build script's trailer line is
// deterministic by construction on top of it: every trailer field is a pure
// function of the tree (package.json version, constants read back out of this
// same byte-identical bundle, git sha/dirty of the checkout).
import { describe, expect, it } from 'vitest'
import { build } from 'esbuild'

// eslint-disable-next-line -- runtime import of the shared build options (plain .mjs, no types)
import { gojaBundleOptions } from '../scripts/bundle-options.mjs'

describe('goja bundle build is deterministic', () => {
  it('back-to-back builds are byte-identical', async () => {
    const first = await build({ ...gojaBundleOptions(), write: false })
    const second = await build({ ...gojaBundleOptions(), write: false })

    const a = Buffer.from(first.outputFiles[0].contents)
    const b = Buffer.from(second.outputFiles[0].contents)
    expect(a.equals(b), 'two builds of the same tree produced different bytes').toBe(true)
    // A visibly non-trivial artifact, not an accidentally-empty file agreeing
    // with itself.
    expect(a.byteLength).toBeGreaterThan(10_000)
  })
})
