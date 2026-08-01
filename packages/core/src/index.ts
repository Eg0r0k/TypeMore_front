/**
 * Framework-free game engine. Zero imports of Vue, Pinia, or the DOM — verified
 * by `tests/purity.test.ts`. This is the only module the server-side validator
 * and the Pinia wrapper depend on.
 *
 * THE single entry point of @typemore/core: the ESM library build AND the
 * server's goja bundle (`dist/core.bundle.js`) are both compiled from this
 * file, and `tests/export-parity.test.ts` pins the two export sets to each
 * other — a bundle built from any other entry cannot pass it. Deep imports
 * (`@typemore/core/src/...`) are rejected by the package `exports` map; if a
 * consumer needs something that is not exported here, exporting it HERE is
 * the change to make.
 */
export * from './events'
export * from './version'
export * from './normalize'
export * from './accents'
export * from './canary'
export * from './words'
export * from './game-core'
export * from './keyboard'
export * from './stats'
export * from './score'
export * from './mods'
export * from './timer'
export * from './validate'
export * from './parse'
