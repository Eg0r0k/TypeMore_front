import type { Component } from 'vue'
import IconShield from '~icons/tabler/shield-check'
import IconCode from '~icons/tabler/code'
import IconTrophy from '~icons/tabler/trophy'
import IconFlask from '~icons/tabler/flask'
import IconBug from '~icons/tabler/bug'
import IconLanguage from '~icons/tabler/language'

/**
 * The badge registry — the ONLY place a badge is defined.
 *
 * The server stores GRANTS and knows codes; it has never had an opinion about
 * what a badge is called, what it says, or what it looks like (backend
 * `internal/badges`, migration 00029). All of that is presentation, it is
 * rendered by this client and queried by nobody, so it lives with the code that
 * renders it — the same argument that keeps the role→permission map in the Go
 * binary that enforces it, pointed the other way.
 *
 * Consequences worth stating, because they are the reason for the shape below:
 *
 * - Adding a badge is TWO commits, ideally one change: a code in the Go list
 *   (so it can be granted) and an entry here (so it can be drawn). The Go side
 *   refuses an unknown code; this side must survive one it has not heard of.
 * - Removing a badge does NOT rewrite history. A grant of a retired code still
 *   reads back from the API, so `badgeOf` answers `null` rather than throwing,
 *   and every render site treats null as "draw nothing".
 * - Colours come from design-system tokens, never from literals. A badge that
 *   invents its own hex is a badge that breaks in half the themes.
 */
export interface BadgeDefinition {
  readonly code: string
  /** Short label — the chip's text and the tooltip's title. */
  readonly name: string
  /** One sentence, shown in the tooltip. What it took to earn this. */
  readonly description: string
  readonly icon: Component
  /**
   * The chip's accent, as a design-system token class. `text-main` is the
   * product's accent; `text-sub` is the quiet one. Anything needing a colour
   * these two cannot express needs a token, not a hex code.
   */
  readonly tone: 'main' | 'sub'
}

/**
 * The codes this client can draw. Declared as a const tuple so `BadgeCode` is a
 * union of literals rather than `string`: `BADGES` below is checked to cover
 * exactly these — a code added here without a definition is a compile error,
 * and a definition for a code that is not here is one too.
 */
export const BADGE_CODES = [
  'staff',
  'contributor',
  'tournament_winner',
  'beta_tester',
  'bug_hunter',
  'translator'
] as const

export type BadgeCode = (typeof BADGE_CODES)[number]

/**
 * `satisfies` rather than a type annotation, and the same pattern the game
 * option registry uses: the object keeps its exact literal type (so `BADGES.staff.name`
 * is a known string, not `string`) while the compiler still proves the record is
 * total over `BadgeCode`.
 */
export const BADGES = {
  staff: {
    code: 'staff',
    name: 'staff',
    description: 'Keeps TypeMore running.',
    icon: IconShield,
    tone: 'main'
  },
  contributor: {
    code: 'contributor',
    name: 'contributor',
    description: 'Contributed code, dictionaries or quotes.',
    icon: IconCode,
    tone: 'main'
  },
  tournament_winner: {
    code: 'tournament_winner',
    name: 'tournament winner',
    description: 'Won an official TypeMore tournament.',
    icon: IconTrophy,
    tone: 'main'
  },
  beta_tester: {
    code: 'beta_tester',
    name: 'beta tester',
    description: 'Played the early builds and reported what broke.',
    icon: IconFlask,
    tone: 'sub'
  },
  bug_hunter: {
    code: 'bug_hunter',
    name: 'bug hunter',
    description: 'Found and reported a real bug.',
    icon: IconBug,
    tone: 'sub'
  },
  translator: {
    code: 'translator',
    name: 'translator',
    description: 'Translated TypeMore into another language.',
    icon: IconLanguage,
    tone: 'sub'
  }
} as const satisfies Record<BadgeCode, BadgeDefinition>

/**
 * The definition for a code, or `null` for one this build has never heard of.
 *
 * NULL RATHER THAN A THROW OR A PLACEHOLDER, deliberately. A grant of a retired
 * code is a real row the server will keep serving forever, and a client that is
 * one deploy behind the Go list will see codes it does not know. Neither is an
 * error the user can act on, so every render site draws nothing instead.
 */
export const badgeOf = (code: string): BadgeDefinition | null =>
  (BADGES as Record<string, BadgeDefinition | undefined>)[code] ?? null

/** The definitions for a list of codes, dropping the ones this build cannot draw. */
export const badgesOf = (codes: readonly string[]): BadgeDefinition[] =>
  codes.map(badgeOf).filter((badge): badge is BadgeDefinition => badge !== null)
