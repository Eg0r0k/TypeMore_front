/**
 * Dispatch an {@link ImeSequence} at a real DOM element.
 *
 * WHY A FACTORY AND NOT `wrapper.trigger()`. happy-dom's `CompositionEvent`
 * constructor exists but IGNORES its init dictionary — `new
 * CompositionEvent('compositionupdate', { data: 'ㅎ' }).data` is `undefined`
 * (verified, happy-dom 20). Vue Test Utils' `trigger` assigns the options onto
 * the constructed event, which cannot reach a readonly accessor either. Both are
 * properties of the TEST ENVIRONMENT, not of the listeners under test, so the
 * fix belongs here: construct the event, then force `data` (and `isComposing`)
 * with `Object.defineProperty`.
 *
 * A real browser needs none of this, which is what the Chromium e2e covers.
 */
import type { ImeSequence, ImeStep } from '../fixtures/ime-sequences'

const define = (event: Event, props: Record<string, unknown>): Event => {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(event, key, { value, configurable: true, enumerable: true })
  }
  return event
}

/** Build the DOM event one step describes, with its data forced on. */
export function imeEvent(step: ImeStep): Event {
  switch (step.kind) {
    case 'compositionstart':
    case 'compositionupdate':
    case 'compositionend': {
      const event = new CompositionEvent(step.kind, { bubbles: true, cancelable: true })
      return define(event, { data: step.data ?? '' })
    }
    case 'beforeinput': {
      const event = new InputEvent('beforeinput', { bubbles: true, cancelable: true })
      return define(event, {
        inputType: step.inputType,
        data: step.data,
        isComposing: step.isComposing === true
      })
    }
    case 'keydown': {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true })
      return define(event, { key: step.key, code: step.code ?? step.key })
    }
  }
}

/**
 * Replay a sequence at `element`, returning the dispatched events so a test can
 * assert on `defaultPrevented` — the only observable difference between "we
 * cancelled this" and "we let the DOM have it", which is the whole contract for
 * composition input types.
 */
export function playSequence(element: Element, sequence: ImeSequence): Event[] {
  const dispatched: Event[] = []
  for (const step of sequence.steps) {
    const event = imeEvent(step)
    element.dispatchEvent(event)
    dispatched.push(event)
  }
  return dispatched
}

/** Replay a single step. */
export function playStep(element: Element, step: ImeStep): Event {
  const event = imeEvent(step)
  element.dispatchEvent(event)
  return event
}
