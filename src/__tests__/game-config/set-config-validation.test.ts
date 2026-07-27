import { describe, expect, it } from 'vitest'
import { GAME_OPTIONS } from '@/entities/game'
import { setConfig } from '@/shared/lib/helpers/config'

/**
 * Pre-flight for routing the settings bar's direct `config[key] = …` writes
 * through `setConfig`: every value the registry can offer for an option must
 * pass the validator, or the re-route would silently drop a write the direct
 * mutation used to let through. A failure here is a registry↔validator drift —
 * a bug to report, not to paper over on either side.
 */
describe('setConfig accepts every value the registry offers', () => {
  for (const option of GAME_OPTIONS) {
    const control = option.control
    const values: readonly (string | number | boolean)[] =
      control.kind === 'boolean' ? [true, false] : control.values

    for (const value of values) {
      it(`${option.key} accepts ${JSON.stringify(value)}`, () => {
        expect(setConfig(option.key, value as never)).toBe(true)
      })
    }
  }
})
