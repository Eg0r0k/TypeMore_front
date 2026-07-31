import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { FIXED_WIDTH_DICTIONARY, stubDictionaries } from './fixtures/dictionaries'
import { installVisibleText } from './support/visible-text'

// Word lists come from the Go server (the frontend ships none); these budget
// probes run without a backend, so every page gets the stubbed catalogue+body.
// The fixed-width corpus rides along for the replay probe (see its header); an
// extra catalogue row is invisible to every other test here.
test.beforeEach(async ({ page }) => {
  await installVisibleText(page)
  await stubDictionaries(page, { extra: [FIXED_WIDTH_DICTIONARY] })
})

/**
 * Put the app in an N-word run.
 *
 * The settings bar only offers the monkeytype presets (10/25/50/100), so a
 * 10 000-word stress run cannot be clicked: it is written into the persisted
 * config the bar itself owns, then loaded by a reload. `clickBarButton('words')`
 * first, so the stored object is the full, real config — patching a partial one
 * would restore a half-empty store.
 */
async function useWordCount(page: Page, count: number): Promise<void> {
  await page.evaluate((words) => {
    const raw = JSON.parse(localStorage.getItem('config') ?? '{}') as {
      config?: Record<string, unknown>
    }
    if (raw.config === undefined) throw new Error('config not persisted yet')
    raw.config.words = words
    raw.config.mode = 'words'
    localStorage.setItem('config', JSON.stringify(raw))
  }, count)
  await page.reload()
  await page.waitForFunction(
    () =>
      (document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word').length ?? 0) > 0
  )
}

/**
 * The keystroke budget probe, run inside the page: type 30 words into the active
 * field and report the worst per-keystroke Word-update count, sync work (ms), and
 * DOM node corridor. Shared by the baseline test and the view-mod variants so the
 * budget is measured identically with each mod active.
 */
async function measureKeystrokeBudget(): Promise<{
  maxUpdates: number
  maxWorkMs: number
  wordsCommitted: number
  maxNodes: number
  lastNodes: number
}> {
  const root = (document.querySelector('.game__host') as HTMLElement).shadowRoot as ShadowRoot
  const input = document.querySelector('.game-input') as HTMLTextAreaElement
  const wordsEl = root.querySelector('.game__words') as HTMLElement
  const activeEl = () => root.querySelector<HTMLElement>('.word.active')
  const nodeCount = () => root.querySelectorAll('.word').length
  const raf = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  const counter = globalThis as { __wordUpdates?: number }
  counter.__wordUpdates = 0

  const ins = (ch: string) =>
    input.dispatchEvent(
      new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: ch,
        bubbles: true,
        cancelable: true
      })
    )
  const commit = () =>
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })
    )

  const settle = async () => {
    await Promise.resolve()
    wordsEl.getBoundingClientRect()
  }

  const nodeSamples = [nodeCount()]
  let maxUpdates = 0
  let maxWorkMs = 0

  for (let w = 0; w < 30; w++) {
    const el = activeEl()
    if (!el) break
    const text = window.__visibleText!(el).replace(/\s+/g, '')
    for (const ch of text) {
      counter.__wordUpdates = 0
      const t0 = performance.now()
      ins(ch)
      await settle()
      maxWorkMs = Math.max(maxWorkMs, performance.now() - t0)
      maxUpdates = Math.max(maxUpdates, counter.__wordUpdates ?? 0)
      await raf()
    }
    counter.__wordUpdates = 0
    const c0 = performance.now()
    commit()
    await settle()
    maxWorkMs = Math.max(maxWorkMs, performance.now() - c0)
    maxUpdates = Math.max(maxUpdates, counter.__wordUpdates ?? 0)
    await raf()
    await raf()
    nodeSamples.push(nodeCount())
  }

  return {
    maxUpdates,
    maxWorkMs,
    wordsCommitted: nodeSamples.length - 1,
    maxNodes: Math.max(...nodeSamples),
    lastNodes: nodeSamples[nodeSamples.length - 1]
  }
}

/**
 * Windowed-render performance budget for a 10 000-word test. Blocking gate for
 * Phase 4/5 (also run in shadow mode after Phase 4). Verifies:
 *   (a) DOM node count stays in a fixed corridor — not proportional to 10 000;
 *   (b) each keystroke updates ≤ 2 Word components (O(1) — via `__wordUpdates`);
 *   (c) per-keystroke render+layout work stays under one 16ms frame budget.
 */
test('10000-word test stays windowed and O(1) per keystroke', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector('.settings-bar__btn')

  // Select words mode + the 10000 preset through the settings bar itself.
  const clickBarButton = (label: string) =>
    page.evaluate((text) => {
      const button = Array.from(document.querySelectorAll<HTMLElement>('.settings-bar__btn')).find(
        (el) => el.textContent?.trim() === text
      )
      button?.click()
    }, label)

  await clickBarButton('words')
  await page.waitForTimeout(80)
  await useWordCount(page, 10000)

  const configWords = await page.evaluate(
    () => JSON.parse(localStorage.getItem('config') ?? '{}').config?.words
  )
  expect(configWords).toBe(10000)

  const metrics = await page.evaluate(async () => {
    // Words live inside the shadow root (open in dev); query from it, not document.
    const root = (document.querySelector('.game__host') as HTMLElement).shadowRoot as ShadowRoot
    const input = document.querySelector('.game-input') as HTMLTextAreaElement
    const wordsEl = root.querySelector('.game__words') as HTMLElement
    const activeEl = () => root.querySelector<HTMLElement>('.word.active')
    const nodeCount = () => root.querySelectorAll('.word').length
    const raf = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const counter = globalThis as { __wordUpdates?: number }
    counter.__wordUpdates = 0

    const ins = (ch: string) =>
      input.dispatchEvent(
        new InputEvent('beforeinput', {
          inputType: 'insertText',
          data: ch,
          bubbles: true,
          cancelable: true
        })
      )
    const commit = () =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })
      )

    // Measure synchronous render + forced-layout cost, excluding rAF idle.
    const settle = async () => {
      await Promise.resolve()
      wordsEl.getBoundingClientRect()
    }

    const nodeSamples = [nodeCount()]
    let maxUpdates = 0
    let maxWorkMs = 0

    for (let w = 0; w < 30; w++) {
      const el = activeEl()
      if (!el) break
      const text = window.__visibleText!(el).replace(/\s+/g, '')
      for (const ch of text) {
        counter.__wordUpdates = 0
        const t0 = performance.now()
        ins(ch)
        await settle()
        maxWorkMs = Math.max(maxWorkMs, performance.now() - t0)
        maxUpdates = Math.max(maxUpdates, counter.__wordUpdates ?? 0)
        await raf()
      }
      counter.__wordUpdates = 0
      const c0 = performance.now()
      commit()
      await settle()
      maxWorkMs = Math.max(maxWorkMs, performance.now() - c0)
      maxUpdates = Math.max(maxUpdates, counter.__wordUpdates ?? 0)
      await raf()
      await raf()
      nodeSamples.push(nodeCount())
    }

    return {
      maxUpdates,
      maxWorkMs,
      wordsCommitted: nodeSamples.length - 1,
      maxNodes: Math.max(...nodeSamples),
      lastNodes: nodeSamples[nodeSamples.length - 1]
    }
  })

  // (a) bounded DOM — a fixed corridor, never proportional to 10 000.
  expect(metrics.maxNodes).toBeLessThan(300)
  expect(metrics.lastNodes).toBeLessThan(300)
  // (b) O(1) per keystroke.
  expect(metrics.maxUpdates).toBeLessThanOrEqual(2)
  // (c) within one frame budget.
  expect(metrics.maxWorkMs).toBeLessThan(16)
  // sanity: the typing actually happened with line jumps.
  expect(metrics.wordsCommitted).toBe(30)
})

/**
 * View-mod fence (blocking gate): the per-keystroke budget must survive with the
 * CSS view mods active. Fading (per-word opacity animation) and Flashlight (a
 * caret-tracking mask) are CSS-only, so ≤ 2 Word updates and < 16ms work must
 * still hold — the mods add paint, never layout or per-keystroke JS.
 */
for (const mods of [['fading'], ['flashlight'], ['fading', 'flashlight']]) {
  test(`keystroke budget holds with view mods active: ${mods.join('+')}`, async ({ page }) => {
    await page.goto('/')
    // Consent given along with the cleared config: the cookie dialog puts
    // `aria-hidden` on everything behind it, so with it open the mod toggles
    // exist in the DOM but not in the accessibility tree — and they are
    // addressed below by their accessible name, being icon-only.
    await page.evaluate(() => {
      localStorage.clear()
      localStorage.setItem('cookieConsentGiven', 'true')
    })
    await page.reload()
    await page.waitForSelector('.settings-bar__btn')

    const clickBarButton = (label: string) =>
      page.evaluate((text) => {
        Array.from(document.querySelectorAll<HTMLElement>('.settings-bar__btn'))
          .find((el) => el.textContent?.trim() === text)
          ?.click()
      }, label)

    await clickBarButton('words')
    await page.waitForTimeout(80)
    await useWordCount(page, 10000)
    for (const mod of mods) {
      // The view mods are chips on the bar's notice line, addressed by their
      // accessible name — which is also the check that a chip a screen reader
      // can announce is what a pointer clicks.
      await page.getByRole('button', { name: mod, exact: true }).click()
      await page.waitForTimeout(40)
    }
    await page.waitForFunction(
      () =>
        (document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word').length ?? 0) >
        0
    )

    // The mods are actually live on the field.
    const state = await page.evaluate(() => {
      const cfg = JSON.parse(localStorage.getItem('config') ?? '{}').config ?? {}
      const words = document.querySelector('.game__host')?.shadowRoot?.querySelector('.game__words')
      return {
        fading: cfg.fading === true,
        flashlight: cfg.flashlight === true,
        cls: words?.className ?? ''
      }
    })
    if (mods.includes('fading')) {
      expect(state.fading).toBe(true)
      expect(state.cls).toContain('tm-fading')
    }
    if (mods.includes('flashlight')) {
      expect(state.flashlight).toBe(true)
      expect(state.cls).toContain('tm-flashlight')
    }

    const metrics = await page.evaluate(measureKeystrokeBudget)
    expect(metrics.maxNodes).toBeLessThan(300)
    expect(metrics.lastNodes).toBeLessThan(300)
    expect(metrics.maxUpdates).toBeLessThanOrEqual(2)
    expect(metrics.maxWorkMs).toBeLessThan(16)
    expect(metrics.wordsCommitted).toBe(30)
  })
}

/**
 * Line-jump timing invariant (blocking gate). After every commit, once the new
 * active word has rendered, the active word must sit on the FIRST or SECOND
 * visible line of the rendered window — never the third. The window has to shift
 * the instant a commit lands the active word on the third line, not one commit
 * later. Regresses if `applyGeometry` reads geometry before the post-commit render
 * (see widgets/test/ui.vue + useLineJump.ts).
 */
test('active word never reaches the third visible line across many line jumps', async ({
  page
}) => {
  test.setTimeout(60_000)
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector('.settings-bar__btn')

  const clickBarButton = (label: string) =>
    page.evaluate((text) => {
      const button = Array.from(document.querySelectorAll<HTMLElement>('.settings-bar__btn')).find(
        (el) => el.textContent?.trim() === text
      )
      button?.click()
    }, label)

  await clickBarButton('words')
  await page.waitForTimeout(80)
  await useWordCount(page, 10000)

  const result = await page.evaluate(async () => {
    const root = (document.querySelector('.game__host') as HTMLElement).shadowRoot as ShadowRoot
    const input = document.querySelector('.game-input') as HTMLTextAreaElement
    const activeEl = () => root.querySelector<HTMLElement>('.word.active')
    const nodeCount = () => root.querySelectorAll('.word').length
    const raf = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const settle = async () => {
      await raf()
      await raf()
    }
    const ins = (ch: string) =>
      input.dispatchEvent(
        new InputEvent('beforeinput', {
          inputType: 'insertText',
          data: ch,
          bubbles: true,
          cancelable: true
        })
      )
    const commit = () =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })
      )

    // Visible line index of the active word among the rendered lines (0 = top).
    // Scrolled-off lines are dropped from the DOM, so the first rendered line is
    // the first visible line.
    const activeLine = (): number => {
      const active = activeEl()
      if (!active) return -1
      const tops = Array.from(
        new Set(Array.from(root.querySelectorAll<HTMLElement>('.word')).map((w) => w.offsetTop))
      ).sort((a, b) => a - b)
      return tops.indexOf(active.offsetTop)
    }

    let maxLine = 0
    let jumps = 0
    let committed = 0
    let prevNodes = nodeCount()
    const linesAfterCommit: number[] = []

    for (let w = 0; w < 90; w++) {
      const el = activeEl()
      if (!el) break
      const text = window.__visibleText!(el).replace(/\s+/g, '')
      for (const ch of text) {
        ins(ch)
        await raf()
      }
      commit()
      committed += 1
      await settle()
      const line = activeLine()
      linesAfterCommit.push(line)
      if (line > maxLine) maxLine = line
      // A window shift drops leading words, so the rendered count falls.
      const nodes = nodeCount()
      if (nodes < prevNodes) jumps += 1
      prevNodes = nodes
      if (maxLine >= 2 && jumps >= 5) break
    }

    return { maxLine, jumps, committed, linesAfterCommit }
  })

  // Enough scrolling happened to make the invariant meaningful.
  expect(result.jumps).toBeGreaterThanOrEqual(5)
  // The invariant: active word is always on the first or second visible line.
  expect(result.maxLine).toBeLessThanOrEqual(1)
})

/**
 * Adjacent case (blocking gate): the active word is pushed to a new line WITHOUT a
 * commit. Extra characters widen the current word and flex-wrap can move it onto the
 * next line mid-typing, so the detector must observe the active word (caret index),
 * not only wordIndex. After each extra keystroke settles, the active word must stay
 * on the first or second visible line — never the third.
 */
test('active word wrapped mid-word by extra characters is pulled back off the third line', async ({
  page
}) => {
  test.setTimeout(60_000)
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector('.settings-bar__btn')

  const clickBarButton = (label: string) =>
    page.evaluate((text) => {
      const button = Array.from(document.querySelectorAll<HTMLElement>('.settings-bar__btn')).find(
        (el) => el.textContent?.trim() === text
      )
      button?.click()
    }, label)

  await clickBarButton('words')
  await page.waitForTimeout(80)
  await useWordCount(page, 10000)

  const result = await page.evaluate(async () => {
    const root = (document.querySelector('.game__host') as HTMLElement).shadowRoot as ShadowRoot
    const input = document.querySelector('.game-input') as HTMLTextAreaElement
    const words = () => Array.from(root.querySelectorAll<HTMLElement>('.word'))
    const activeEl = () => root.querySelector<HTMLElement>('.word.active')
    const nodeCount = () => root.querySelectorAll('.word').length
    const raf = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const settle = async () => {
      await raf()
      await raf()
    }
    const ins = (ch: string) =>
      input.dispatchEvent(
        new InputEvent('beforeinput', {
          inputType: 'insertText',
          data: ch,
          bubbles: true,
          cancelable: true
        })
      )
    const commit = () =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })
      )

    const activeLine = (): number => {
      const active = activeEl()
      if (!active) return -1
      const tops = Array.from(new Set(words().map((w) => w.offsetTop))).sort((a, b) => a - b)
      return tops.indexOf(active.offsetTop)
    }
    // Active word is on the second visible line and is the last one that fits there,
    // so a few extra characters are guaranteed to wrap it onto the third line.
    const lastOnSecondLine = (): boolean => {
      const active = activeEl()
      if (!active || activeLine() !== 1) return false
      const list = words()
      const next = list[list.indexOf(active) + 1]
      return !!next && next.offsetTop > active.offsetTop
    }

    // Commit words until the active word is the last one on the second visible line.
    let guard = 0
    while (!lastOnSecondLine() && guard < 200) {
      const el = activeEl()
      if (!el) break
      const text = window.__visibleText!(el).replace(/\s+/g, '')
      for (const ch of text) {
        ins(ch)
        await raf()
      }
      commit()
      await settle()
      guard += 1
    }
    const positioned = lastOnSecondLine()

    // Type the word's own letters, then EXTRA characters (no commit) to widen + wrap it.
    const target = window.__visibleText!(activeEl()).replace(/\s+/g, '')
    for (const ch of target) {
      ins(ch)
      await raf()
    }
    let maxLine = activeLine()
    let drops = 0
    let prevNodes = nodeCount()
    for (let k = 0; k < 18; k++) {
      ins('x')
      await settle()
      const line = activeLine()
      if (line > maxLine) maxLine = line
      const nodes = nodeCount()
      if (nodes < prevNodes) drops += 1
      prevNodes = nodes
    }

    return { positioned, maxLine, drops }
  })

  // The wrap scenario was actually set up and the word actually wrapped (a line recycled).
  expect(result.positioned).toBe(true)
  expect(result.drops).toBeGreaterThanOrEqual(1)
  // The invariant holds even for a mid-word wrap.
  expect(result.maxLine).toBeLessThanOrEqual(1)
})

/**
 * The blocking render contracts (bounded DOM corridor + the active-word line
 * invariant) must also hold on the REPLAY field — it is the same GameField
 * rendering a GhostDriver's view-model (complete log, zero display delay).
 * Finish a real run, open the replay, and sample its shadow DOM along the
 * playback timeline.
 *
 * DETERMINISM — this probe used to be the file's known flake, in two places:
 *
 *  1. The text was 45 words of German drawn on whatever seed the client rolled.
 *     A short draw fits in two lines, never jumps one, and `drops >= 1` fails
 *     over the dictionary rather than over the renderer. It now runs on the
 *     fixed-width corpus (every word ten characters), and the wrap is asserted
 *     as a PRECONDITION before playback, so a layout change reports itself
 *     instead of surfacing as a mystery assertion at the bottom.
 *  2. The sampler polled the wall clock — `sleep(40)` × 120, racing the rAF
 *     loop that advances the replay — so which frames it caught depended on how
 *     loaded the machine was. It now DRIVES the timeline instead of chasing it:
 *     hold the pointer down on the seek bar (which pauses playback) and drag it
 *     across in fixed fractions, sampling after each step. No clock is read, no
 *     duration is assumed, and the same 61 frames are inspected every run.
 */
test('replay field honors the DOM corridor and line-position invariant', async ({ page }) => {
  test.setTimeout(60_000)
  const RUN_WORDS = 45
  /** Sample count across the timeline: ~0.75 words per step at 45 words. */
  const STEPS = 60
  const cfg = {
    devTools: false,
    words: RUN_WORDS,
    time: 15,
    fontSize: 16,
    fontFamily: 'Hack',
    language: FIXED_WIDTH_DICTIONARY.lang,
    showKeyboard: false,
    theme: 'VS Code',
    mode: 'words',
    backgroundImg: '',
    showFps: false,
    playSound: false,
    soundVolume: 0.5,
    punctuation: false,
    numbers: false,
    randomCase: false,
    nospace: false,
    difficulty: 'normal',
    blind: false
  }
  await page.goto('/')
  await page.evaluate((c) => {
    localStorage.setItem('config', JSON.stringify({ config: c }))
    localStorage.setItem('cookieConsentGiven', 'true')
  }, cfg)
  await page.reload()
  await page.waitForSelector('.game__host')
  await page.waitForFunction(
    (n) =>
      (document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word').length ?? 0) ===
      n,
    RUN_WORDS
  )

  // PRECONDITION: this run wraps, and it wraps the same way every time. Uniform
  // word width at a fixed viewport makes the line count a constant — if it ever
  // stops being ≥ 3, the scroll assertions below are testing nothing and this is
  // the line that says so.
  const layout = await page.evaluate(() => {
    const root = (document.querySelector('.game__host') as HTMLElement).shadowRoot as ShadowRoot
    const words = Array.from(root.querySelectorAll<HTMLElement>('.word'))
    const lengths = new Set(words.map((w) => window.__visibleText!(w).replace(/\s+/g, '').length))
    const tops = new Set(words.map((w) => w.offsetTop))
    return { widths: lengths.size, length: [...lengths][0], lines: tops.size, words: words.length }
  })
  expect(layout.words).toBe(RUN_WORDS)
  expect(layout.widths).toBe(1) // one uniform word width, hence one stable wrap
  expect(layout.length).toBe(FIXED_WIDTH_DICTIONARY.words[0].length)
  expect(layout.lines).toBeGreaterThanOrEqual(3)

  // Type the whole run to completion.
  await page.evaluate(async (total) => {
    const root = () =>
      (document.querySelector('.game__host') as HTMLElement)?.shadowRoot as ShadowRoot
    const input = document.querySelector('.game-input') as HTMLTextAreaElement
    const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
    const activeText = () => {
      const a = root()?.querySelector<HTMLElement>('.word.active')
      return a ? window.__visibleText!(a).replace(/\s+/g, '') : null
    }
    const ins = (ch: string) =>
      input.dispatchEvent(
        new InputEvent('beforeinput', {
          inputType: 'insertText',
          data: ch,
          bubbles: true,
          cancelable: true
        })
      )
    const commit = () =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })
      )
    for (let w = 0; w < total; w++) {
      const t = activeText()
      if (!t) break
      for (const ch of t) {
        ins(ch)
        await raf()
      }
      commit()
      await raf()
    }
  }, RUN_WORDS)

  // Results screen, then open the replay (an icon-only action, addressed by id).
  await page.waitForSelector('[data-testid="results-replay"]', { timeout: 8000 })
  await page.click('[data-testid="results-replay"]')
  await page.waitForSelector('.game__host', { timeout: 8000 })

  /**
   * One frame of the replay field, read after the pending seek has landed.
   *
   * Three frames of slack, not a duration: the seek queued by `pointermove` is
   * applied by the player's next rAF, Vue re-renders on the tick after that,
   * and the line-jump pass (`applyGeometry`) runs a further two microtask ticks
   * later. Nothing here waits on elapsed time.
   */
  const sampleFrame = () =>
    page.evaluate(async () => {
      const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
      await raf()
      await raf()
      await raf()
      const root = (document.querySelector('.game__host') as HTMLElement).shadowRoot as ShadowRoot
      const words = Array.from(root.querySelectorAll<HTMLElement>('.word'))
      const active = root.querySelector<HTMLElement>('.word.active')
      const tops = Array.from(new Set(words.map((w) => w.offsetTop))).sort((a, b) => a - b)
      return {
        nodes: words.length,
        line: active === null ? -1 : tops.indexOf(active.offsetTop)
      }
    })

  const seek = page.getByTestId('replay-seek')
  await seek.waitFor()
  const box = (await seek.boundingBox())!
  const y = box.y + box.height / 2
  const xAt = (fraction: number) => box.x + 1 + (box.width - 2) * fraction

  // Pointer DOWN and held: `onSeekDown` stops playback and seeks to the start,
  // so everything after this is driven by us, not by the clock. Each move
  // records the next target and the player's own frame loop applies it.
  await page.mouse.move(xAt(0), y)
  await page.mouse.down()
  const frames = [await sampleFrame()]
  for (let i = 1; i <= STEPS; i++) {
    await page.mouse.move(xAt(i / STEPS), y)
    frames.push(await sampleFrame())
  }
  await page.mouse.up()

  const withActive = frames.filter((f) => f.line >= 0)
  // The field rendered a run, not an empty tape: the last frame sits past the
  // final commit, where there is no active word left, but everything before it
  // has one.
  expect(withActive.length).toBeGreaterThanOrEqual(STEPS)
  // (a) bounded DOM corridor on the replay field.
  expect(Math.max(...frames.map((f) => f.nodes))).toBeLessThan(300)
  // Playback actually scrolled: the window only ever advances, so a smaller
  // node count means whole leading lines were recycled.
  const drops = frames.filter((f, i) => i > 0 && f.nodes < frames[i - 1].nodes).length
  expect(drops).toBeGreaterThanOrEqual(1)
  expect(frames[frames.length - 1].nodes).toBeLessThan(frames[0].nodes)
  // (b) active word never reached the third visible line during replay.
  expect(Math.max(...withActive.map((f) => f.line))).toBeLessThanOrEqual(1)
})

/**
 * Match-screen coexistence gate (Phase B): 1 local field + 4 ghost fields on
 * one page at 10 000 words. The LOCAL field must keep the existing per-keystroke
 * budgets (≤ 2 Word updates, < 16 ms work) and every field must hold the bounded
 * DOM corridor — total nodes never proportional to word count or player count.
 * Ghosts are static here (botwpm=0): `__wordUpdates` is a global counter, so a
 * typing bot would pollute the local budget measurement. Live-bot progression is
 * asserted separately below.
 */
test('match screen: 1 local + 4 ghosts at 10k words keeps keystroke budget and bounded DOM', async ({
  page
}) => {
  test.setTimeout(60_000)
  await page.goto('/match?words=10000&ghosts=4&botwpm=0&seed=42')
  await page.waitForFunction(() => document.querySelectorAll('.game__host').length === 5)
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll<HTMLElement>('.game__host')).every(
      (host) => (host.shadowRoot?.querySelectorAll('.word').length ?? 0) > 0
    )
  )

  const metrics = await page.evaluate(async () => {
    const hosts = Array.from(document.querySelectorAll<HTMLElement>('.game__host'))
    const localRoot = (document.querySelector('.match__local .game__host') as HTMLElement)
      .shadowRoot as ShadowRoot
    const input = document.querySelector('.game-input') as HTMLTextAreaElement
    const wordsEl = localRoot.querySelector('.game__words') as HTMLElement
    const activeEl = () => localRoot.querySelector<HTMLElement>('.word.active')
    const totalNodes = () =>
      hosts.reduce((sum, host) => sum + (host.shadowRoot?.querySelectorAll('.word').length ?? 0), 0)
    const raf = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const counter = globalThis as { __wordUpdates?: number }
    counter.__wordUpdates = 0

    const ins = (ch: string) =>
      input.dispatchEvent(
        new InputEvent('beforeinput', {
          inputType: 'insertText',
          data: ch,
          bubbles: true,
          cancelable: true
        })
      )
    const commit = () =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })
      )
    const settle = async () => {
      await Promise.resolve()
      wordsEl.getBoundingClientRect()
    }

    const nodeSamples = [totalNodes()]
    let maxUpdates = 0
    let maxWorkMs = 0

    for (let w = 0; w < 15; w++) {
      const el = activeEl()
      if (!el) break
      const text = window.__visibleText!(el).replace(/\s+/g, '')
      for (const ch of text) {
        counter.__wordUpdates = 0
        const t0 = performance.now()
        ins(ch)
        await settle()
        maxWorkMs = Math.max(maxWorkMs, performance.now() - t0)
        maxUpdates = Math.max(maxUpdates, counter.__wordUpdates ?? 0)
        await raf()
      }
      counter.__wordUpdates = 0
      const c0 = performance.now()
      commit()
      await settle()
      maxWorkMs = Math.max(maxWorkMs, performance.now() - c0)
      maxUpdates = Math.max(maxUpdates, counter.__wordUpdates ?? 0)
      await raf()
      await raf()
      nodeSamples.push(totalNodes())
    }

    return {
      hostCount: hosts.length,
      maxUpdates,
      maxWorkMs,
      wordsCommitted: nodeSamples.length - 1,
      maxTotalNodes: Math.max(...nodeSamples)
    }
  })

  expect(metrics.hostCount).toBe(5)
  // Local keystroke budget unchanged by 4 coexisting ghost fields.
  expect(metrics.maxUpdates).toBeLessThanOrEqual(2)
  expect(metrics.maxWorkMs).toBeLessThan(16)
  // 5 bounded corridors, never 5 × 10 000.
  expect(metrics.maxTotalNodes).toBeLessThan(1500)
  expect(metrics.wordsCommitted).toBe(15)
})

/**
 * Live bots: ghost fields progress from relayed (DemoFeed) events while the
 * local player types, and every corridor stays bounded. Bots start on the match
 * clock, which anchors at the local run's start — so type first, then observe.
 */
test('match screen: live ghosts progress and stay windowed', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/match?words=10000&ghosts=4&botwpm=120&seed=42')
  await page.waitForFunction(() => document.querySelectorAll('.game__host').length === 5)
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll<HTMLElement>('.game__host')).every(
      (host) => (host.shadowRoot?.querySelectorAll('.word').length ?? 0) > 0
    )
  )

  // Start the local run — this arms the shared match clock (t=0).
  await page.evaluate(() => {
    const input = document.querySelector('.game-input') as HTMLTextAreaElement
    input.dispatchEvent(
      new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: 'a',
        bubbles: true,
        cancelable: true
      })
    )
  })

  // Every ghost advances past word 0 (120+ wpm bots cross a word boundary fast).
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll<HTMLElement>('.match__ghost-progress')).filter((el) => {
        const current = Number.parseInt(el.textContent ?? '0', 10)
        return current > 0
      }).length === 4,
    undefined,
    { timeout: 20_000 }
  )

  const bounded = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('.game__host')).every(
      (host) => (host.shadowRoot?.querySelectorAll('.word').length ?? 0) < 300
    )
  )
  expect(bounded).toBe(true)
})

/**
 * Live score HUD (osu-style) budget. The HUD is sibling chrome OUTSIDE the field
 * and its shadow root, so its updates must be plain text-node writes: a constant,
 * tiny node count regardless of keystrokes, and zero layout thrash on the field
 * (it lives in an absolute slot, like the settings bar). Blocking gate for the
 * scoreV1 HUD.
 */
test('live score HUD updates in O(1) nodes and never shifts the field', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector('.settings-bar__btn')

  const clickBarButton = (label: string) =>
    page.evaluate((text) => {
      const button = Array.from(document.querySelectorAll<HTMLElement>('.settings-bar__btn')).find(
        (el) => el.textContent?.trim() === text
      )
      button?.click()
    }, label)

  await clickBarButton('words')
  await page.waitForFunction(
    () =>
      (document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word').length ?? 0) > 0
  )

  // Idle: no run yet, so the HUD is not rendered (v-show off).
  const hiddenIdle = await page.evaluate(() => {
    const hud = document.querySelector('.score-hud') as HTMLElement | null
    return !hud || hud.offsetParent === null
  })
  expect(hiddenIdle).toBe(true)

  const result = await page.evaluate(async () => {
    const input = document.querySelector('.game-input') as HTMLTextAreaElement
    const root = (document.querySelector('.game__host') as HTMLElement).shadowRoot as ShadowRoot
    const activeEl = () => root.querySelector<HTMLElement>('.word.active')
    const viewport = document.querySelector('.game__viewport') as HTMLElement
    const hud = () => document.querySelector('.score-hud') as HTMLElement | null
    const raf = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const ins = (ch: string) =>
      input.dispatchEvent(
        new InputEvent('beforeinput', {
          inputType: 'insertText',
          data: ch,
          bubbles: true,
          cancelable: true
        })
      )
    const commit = () =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })
      )

    const rect0 = viewport.getBoundingClientRect()
    let fieldStable = true
    const hudNodeCounts: number[] = []
    let typed = 0

    for (let w = 0; w < 2; w++) {
      const el = activeEl()
      if (!el) break
      const text = window.__visibleText!(el).replace(/\s+/g, '')
      for (const ch of text) {
        ins(ch)
        typed++
        await raf()
        const h = hud()
        // Descendant element count of the HUD — must be constant (text-node updates only).
        hudNodeCounts.push(h ? h.querySelectorAll('*').length : -1)
        const rect = viewport.getBoundingClientRect()
        if (Math.abs(rect.top - rect0.top) > 0.5 || Math.abs(rect.height - rect0.height) > 0.5)
          fieldStable = false
      }
      commit()
      await raf()
    }

    const h = hud()
    return {
      hudVisible: !!h && h.offsetParent !== null,
      hudText: (h?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      hudNodeCounts,
      fieldStable,
      typed
    }
  })

  expect(result.typed).toBeGreaterThan(0)
  expect(result.hudVisible).toBe(true)
  // O(1) nodes: a constant, tiny descendant count no matter how many keys are typed
  // (score + combo + speed spans; the mod chip is absent in a no-mod run).
  expect(Array.from(new Set(result.hudNodeCounts))).toEqual([3])
  // The HUD's absolute slot never nudges the field geometry.
  expect(result.fieldStable).toBe(true)
  // The combo/multiplier text actually rendered and advanced.
  expect(result.hudText).toMatch(/×/)
})
