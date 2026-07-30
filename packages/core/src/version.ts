/**
 * Package identity, embedded into every build artifact.
 *
 * `CORE_PACKAGE_VERSION` is substituted at build time (`scripts/build.mjs`
 * passes an esbuild `--define` for the placeholder below) with the version
 * from package.json, so both dist artifacts — the ESM library and the goja
 * bundle — carry the version they were built from as an exported constant.
 * The server reads it off the bundle at startup and logs it next to the
 * bundle SHA (TypeMore_back internal/replay).
 *
 * Consumed straight from source (workspace dev, vitest) the placeholder does
 * not exist and the constant reports a dev marker instead — `typeof` on an
 * undeclared identifier is the one safe way to probe that.
 */
declare const __TYPEMORE_CORE_VERSION__: string | undefined

export const CORE_PACKAGE_VERSION: string =
  typeof __TYPEMORE_CORE_VERSION__ === 'string' ? __TYPEMORE_CORE_VERSION__ : '0.0.0-dev'
