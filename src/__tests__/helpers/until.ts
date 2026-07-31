/**
 * Poll `cond` every `stepMs` until it holds, failing loudly (with `label` in
 * the message) after `timeoutMs`. Real `setTimeout` on purpose: the match
 * suites that await this run real timers and a loopback transport, and the
 * condition is driven by machinery outside Vue's reactivity — there is
 * nothing to flush, only time to pass.
 */
export async function until(
  cond: () => boolean,
  label: string,
  timeoutMs = 10_000,
  stepMs = 5
): Promise<void> {
  const startedAt = Date.now()
  while (!cond()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error(`timed out waiting for ${label}`)
    const { promise, resolve } = Promise.withResolvers<void>()
    setTimeout(resolve, stepMs)
    await promise
  }
}
