export type ReplayAction = 'correct' | 'incorrect' | 'backWord' | ''
export type Replay = {
  action: ReplayAction
  value: string | number
  time: number
}