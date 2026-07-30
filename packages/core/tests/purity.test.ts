// @vitest-environment node
//
// The core is the server-side validation engine: it must run in plain Node with
// no DOM and no framework. This suite enforces that contract two ways — it drives
// a full game headless, and it statically scans the core source for forbidden
// imports/globals (Vue, Pinia, the DOM, wall clocks, Math.random).
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { type CoreConfig, GameCore, commitEvent, insertEvent, metricsOf } from '@typemore/core'

const coreDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')

describe('core runs headless in pure Node', () => {
  it('has no DOM and computes metrics for a full game', () => {
    expect(typeof window).toBe('undefined')
    expect(typeof document).toBe('undefined')

    const config: CoreConfig = {
      mode: 'words',
      durationMs: 0,
      maxExtraChars: 20,
      difficulty: 'normal',
      nospace: false
    }
    const core = new GameCore({ config, words: ['hi'] })
    core.dispatch(insertEvent(1, 0, 'h'))
    core.dispatch(insertEvent(2, 80, 'i'))
    core.dispatch(commitEvent(3, 160))

    expect(core.state.phase).toBe('finished')
    const metrics = metricsOf(core)
    expect(metrics.accuracy).toBe(1)
    expect(metrics.wpm).toBeGreaterThan(0)
  })
})

describe('core source is framework-free', () => {
  const forbidden: readonly RegExp[] = [
    /from ['"]vue['"]/,
    /from ['"]pinia['"]/,
    /from ['"]@vue\//,
    /\bMath\.random\b/,
    /\bDate\.now\b/,
    /\bperformance\./,
    /\bdocument\./,
    /\bwindow\./,
    /\bsetTimeout\b/,
    /\bsetInterval\b/
  ]

  // Reducer/metrics logic only. The Phase 2 timer worker (`*.worker.ts`) is a
  // thin cadence shell that legitimately uses worker globals, so it is excluded.
  const files = readdirSync(coreDir).filter(
    (name) => name.endsWith('.ts') && !name.endsWith('.worker.ts')
  )

  it('scans more than one source file, score.ts included', () => {
    expect(files.length).toBeGreaterThan(1)
    expect(files).toContain('score.ts')
  })

  it.each(files)('%s imports no framework and reads no clock/DOM', (file) => {
    // Path is built from a fixed in-repo directory listing, not user input.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const source = readFileSync(join(coreDir, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '') // strip block comments (they discuss these very tokens)
      .replace(/\/\/.*$/gm, '') // strip line comments
    for (const pattern of forbidden) {
      expect(pattern.test(source), `${file} must not match ${pattern}`).toBe(false)
    }
  })
})
