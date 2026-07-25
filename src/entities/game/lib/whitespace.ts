/**
 * Layout characters inside target words (monkeytype's code/quote mode).
 *
 * A word list is normally whitespace-free — the separator between two words is
 * the `commit` event, never a character. Code snippets and quotes are the
 * exception: monkeytype folds the indentation into the word that follows it
 * (`\t` at the head) and the line break into the word that ends the line (`\n`
 * at the tail), and renders both as glyphs (`test-ui.ts` `buildWordHTML`).
 *
 * These three predicates are the whole contract the UI needs: the field asks
 * whether a word ends a line, and the input adapter asks whether the run has
 * tabs at all (Tab only becomes a typing key for a word list that contains one —
 * otherwise it stays the browser's focus key, exactly like monkeytype gates it
 * behind `wordsHaveTab()`).
 */

/** `\t` appears somewhere in the word list — Tab types instead of moving focus. */
export const wordsHaveTab = (words: readonly string[]): boolean =>
  words.some((word) => word.includes('\t'))

/** `\n` appears somewhere in the word list — the run renders as lines. */
export const wordsHaveNewline = (words: readonly string[]): boolean =>
  words.some((word) => word.includes('\n'))

/** The word carries a line break, so the next word starts a new visual line. */
export const wordBreaksLine = (word: string): boolean => word.includes('\n')
