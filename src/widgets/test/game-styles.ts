/**
 * Styles for the words view, injected INTO the shadow root.
 *
 * The words are rendered inside a shadow root (anti-scrape layer 1), so Vue's
 * scoped `<style>` (emitted to `<head>` with `data-v-*`) does not reach them.
 * These plain-class rules are injected into the shadow instead. Theme design
 * tokens (`--text-color`, `--sub-color`, `--main-color`, `--error-color`, …) are
 * inherited across the shadow boundary from the themed host, so no token values
 * are duplicated here.
 */
import { GHOST_LABEL_HEIGHT, GHOST_LABEL_MAX_WIDTH } from '@shared/lib/hooks/useGhostCarets'
import type { SmoothCaret } from '@/shared/constants/type'

/** Fading mod: ms for a word to melt from full opacity to 0. Exported for the widget + tests. */
export const FADE_MS = 1000

/**
 * Smooth-caret transition durations, keyed by the `smoothCaret` config value.
 * `off` is 0ms — the caret snaps, which is what "off" means for a transform
 * transition (no separate rule needed). Fed to the caret as `--tm-caret-ms`.
 */
export const SMOOTH_CARET_MS: Record<SmoothCaret, number> = {
  off: 0,
  slow: 250,
  medium: 120,
  fast: 60
}

export const WORDS_SHADOW_STYLES = `
.game__words {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  width: 100%;
  will-change: transform;
}
.game__words--tape { flex-wrap: nowrap; }

/* Caret. Geometry arrives as CSS vars measured off the letter the caret sits on
   (--tm-caret-w / --tm-caret-h) plus the smooth-caret duration --tm-caret-ms;
   the widget takes them from props, never from config. The base rule IS the
   "default" style (thin vertical bar); each other style is a modifier, and
   "off" renders no element at all, so it has no rule. The width guard keeps a
   style visible when geometry has not been measured yet (0px) — it degrades to
   the default bar rather than vanishing. */
.game__caret {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  width: 2px;
  height: var(--tm-caret-h, 0px);
  background: var(--main-color, var(--text-color));
  transition: transform var(--tm-caret-ms, 120ms) ease;
  will-change: transform;
}
/* Block: fills the character cell; translucent so the glyph under it stays legible. */
.game__caret--block {
  width: max(var(--tm-caret-w, 2px), 2px);
  opacity: 0.4;
}
/* Outline: the same cell drawn as an empty box. */
.game__caret--outline {
  width: max(var(--tm-caret-w, 2px), 2px);
  background: transparent;
  border: 2px solid var(--main-color, var(--text-color));
}
/* Underline: a full-cell-wide bar dropped just below the character. */
.game__caret--underline {
  top: var(--tm-caret-h, 0px);
  width: max(var(--tm-caret-w, 2px), 2px);
  height: 2px;
}

/* RTL: the measured x is the INSERTION POINT, which in mirrored text is the
   cell's right edge (useCaret) — but a caret is still drawn rightwards from its
   own left edge, because transform and left are physical, not logical. The thin
   bar is 2px and sits on the boundary either way; the three full-cell styles
   have to be pulled back by their own width or they would fill the cell BEFORE
   the one they mark. (No backticks in this file: it is one template literal.) */
.game__words--rtl .game__caret--block,
.game__words--rtl .game__caret--outline,
.game__words--rtl .game__caret--underline {
  margin-left: calc(-1 * max(var(--tm-caret-w, 2px), 2px));
}

/* Ghost (opponent) carets — racing "ghost cars" inside the local field. Sub-
   colored + translucent so the primary local caret always reads first; the
   tiny nick label hugs the bar and never intercepts the pointer.

   The label is sized from the shared constants because the placement math in
   useGhostCarets measures against exactly this box: the words viewport clips
   (overflow: hidden), so a nick that does not fit above the bar (first rendered
   line) or to its right (right edge) is flipped instead of cut off. */
.game__ghost-caret {
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  background: var(--sub-color);
  opacity: 0.7;
  /* Defaults are the relayed opponent's: a short ease that smooths the jitter
     of positions arriving off the wire. A PACED caret (the pace bot) overrides
     both — it knows exactly when its next character is due, so it travels for
     exactly that long at constant speed. */
  transition: transform var(--tm-ghost-ms, 0.12s) var(--tm-ghost-ease, ease);
  will-change: transform;
  pointer-events: none;
}
.game__ghost-caret-label {
  position: absolute;
  bottom: 100%;
  left: 0;
  box-sizing: border-box;
  height: ${GHOST_LABEL_HEIGHT}px;
  max-width: ${GHOST_LABEL_MAX_WIDTH}px;
  overflow: hidden;
  padding-bottom: 3px;
  font-size: 10px;
  line-height: 10px;
  color: var(--sub-color);
  white-space: nowrap;
  text-overflow: ellipsis;
}
.game__ghost-caret--label-below .game__ghost-caret-label {
  top: 100%;
  bottom: auto;
  padding-top: 3px;
  padding-bottom: 0;
}
.game__ghost-caret--label-left .game__ghost-caret-label {
  right: 0;
  left: auto;
  text-align: right;
}

/* Line box vs glyph box: at 32px the fonts in our stack need 41px (Hack, latin
   AND cyrillic) up to 50px (Vazirmatn, the fallback for scripts Hack lacks) of
   content. A 1em line-height gave the glyph LESS room than it needs, so every
   descender (g, y, р, ц) hung outside its own line box — where the viewport's
   clip edge and the error underline cut it. 1.6em covers the tallest font in
   the stack, so a glyph never leaves its line and nothing can slice it; the
   vertical margin goes to 0 because the leading now provides the row gap
   (ink-to-ink spacing is unchanged, ~10px). Keep GAME_ROW_STEP in the widget's
   viewport height in sync when touching these. */
.word {
  position: relative;
  margin: 0 0.3em;
  font-size: var(--tm-font-size, 32px);
  line-height: 1.6em;
  color: var(--sub-color);
  border-bottom: 2px solid transparent;
}
.word--error { border-bottom: 2px solid var(--error-color); }

/* The letter keeps the em box: caret geometry is measured off it, and a caret
   as tall as the (now leaded) line box would tower over the text. */
.letter { display: inline-block; line-height: 1em; }
.correct { color: var(--text-color); }
.incorrect { color: var(--error-color); }
.extra { color: var(--error-extra-color, var(--error-color)); }
/* Missed: muted, NOT a red error — only the word underline signals the error. */
.missed { color: var(--sub-color); }

/* An IME's in-flight character (monkeytype's "dead" letter). Underlined because
   that is the platform convention for composing text everywhere else a person
   types — the browser's own composition underline, which we lose by owning the
   rendering. No new colour: it inherits whatever correctness class it already
   carries, so a composed character that already matches reads as correct and one
   that does not reads as untyped, which is exactly what it is until the session
   ends. */
.letter--dead {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 0.15em;
}

/* Tab / newline glyphs (monkeytype's tabChar/nlChar): a real letter box the
   caret can measure, drawn faint so the code text stays readable. Correctness
   colours above still win — a mistyped newline must read as an error. */
.letter--ws { opacity: 0.45; }

/* A tab is INDENTATION, not a glyph-sized character: it occupies one tab stop,
   so the lines of a code quote align under each other and the arrow sits at the
   left of that space. It stays ONE measurable letter box, which is what keeps
   the caret right on it — the caret is drawn from the box it sits on, so an
   indent faked with margin or padding would put the caret in the wrong place.
   After the generator's newline normalisation a tab only ever opens a token, so
   this is the line's indent and nothing else. */
.letter--tab { width: var(--tm-tab-width, 4ch); }

/* Forced line break after a word that ends with \\n. Flexbox has no break-after,
   so the only mechanism is a full-width item: it cannot share a line with the
   word before it, wraps onto a zero-height line of its own, and pushes the next
   word down. It is deliberately NOT a .word — useLineJump, useScrollTape and
   useGhostCarets all index .word nodes by window slot. Tape mode is a single
   nowrap row, so breaks are suppressed there. */
.line-break { width: 100%; height: 0; }
.game__words--tape .line-break { display: none; }

/* Fading mod (view-only): the active word melts to nothing over --tm-fade-ms.
   CSS-only — driven by the .active class already toggled once per commit, so it
   adds no per-keystroke work and never re-renders non-active words. */
@keyframes tm-fade { from { opacity: 1; } to { opacity: 0; } }
.game__words.tm-fading .word.active {
  animation: tm-fade var(--tm-fade-ms, 1000ms) linear forwards;
}

/* Flashlight mod (view-only): reveal only a disc around the caret; the mask
   centre follows the caret through CSS vars the widget sets from the existing
   caret geometry (no new measurement, GPU-composited paint). */
.game__words.tm-flashlight {
  -webkit-mask-image: radial-gradient(circle var(--tm-fl-radius, 4.5em) at var(--tm-fl-x, 50%) var(--tm-fl-y, 50%), #000 55%, rgba(0, 0, 0, 0) 100%);
  mask-image: radial-gradient(circle var(--tm-fl-radius, 4.5em) at var(--tm-fl-x, 50%) var(--tm-fl-y, 50%), #000 55%, rgba(0, 0, 0, 0) 100%);
}
`
