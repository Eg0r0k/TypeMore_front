/**
 * The one rewrite between the dictionary key space and the quote key space.
 *
 * The guard that makes this safe is negative and lives upstream: no quote
 * corpus key ends in `_<n>k`. These cases pin the shape of the rule so a future
 * "just strip everything after the last underscore" cannot land quietly — that
 * version would send `arabian_egypt` to `arabian` and `norwegian_bokmal` to
 * `norwegian`, silently serving the wrong corpus for languages that have one of
 * their own.
 */
import { describe, expect, it } from 'vitest'

import { isSizeVariant, quoteCorpusLang } from '@/shared/api/quotes/lang'

describe('quoteCorpusLang', () => {
  it('strips a size suffix, at every size the catalogue ships', () => {
    expect(quoteCorpusLang('russian_50k')).toBe('russian')
    expect(quoteCorpusLang('english_1k')).toBe('english')
    expect(quoteCorpusLang('english_10k')).toBe('english')
    expect(quoteCorpusLang('german_250k')).toBe('german')
    expect(quoteCorpusLang('english_450k')).toBe('english')
  })

  it('leaves a plain language alone', () => {
    expect(quoteCorpusLang('russian')).toBe('russian')
    expect(quoteCorpusLang('english')).toBe('english')
    expect(quoteCorpusLang('code_python')).toBe('code_python')
  })

  it('does not touch a suffix that names a different corpus', () => {
    // Each of these has a quote corpus of its OWN; rewriting them would serve
    // the wrong text under the right name.
    expect(quoteCorpusLang('arabian_egypt')).toBe('arabian_egypt')
    expect(quoteCorpusLang('norwegian_bokmal')).toBe('norwegian_bokmal')
    expect(quoteCorpusLang('tamil_old')).toBe('tamil_old')
    expect(quoteCorpusLang('esperanto_x_sistemo')).toBe('esperanto_x_sistemo')
  })

  it('leaves a language that simply has no corpus to 404 honestly', () => {
    // Pre-reform orthography: a real language with no upstream quotes. Mapping
    // it to `russian` would hand the player modern Russian under a key that
    // promises the old spelling.
    expect(quoteCorpusLang('russian_empire')).toBe('russian_empire')
  })

  it('needs a digit before the k, so a name ending in k survives', () => {
    expect(quoteCorpusLang('slovak')).toBe('slovak')
    expect(quoteCorpusLang('code_k')).toBe('code_k')
    expect(quoteCorpusLang('lang_k')).toBe('lang_k')
  })

  it('reports whether a draw will be served under another key', () => {
    expect(isSizeVariant('russian_50k')).toBe(true)
    expect(isSizeVariant('russian')).toBe(false)
    expect(isSizeVariant('russian_empire')).toBe(false)
  })
})
