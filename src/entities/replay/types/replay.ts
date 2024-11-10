export type ReplayAction =
  | 'correctLetter'
  | 'incorrectLetter'
  | 'backWord'
  | 'submitCorrectWord'
  | 'submitErrorWord'
  | 'setLetterIndex'
export type Replay = {
  action: ReplayAction
  value?: string | number
  time: number
}
