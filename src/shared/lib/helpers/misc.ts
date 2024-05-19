const G = 0.5772156649

export const logRandomIndex = (arrayLen: number): number => {
  const len = arrayLen
  const M = Math.log(len) + G
  const rand = Math.random()
  const h = Math.exp(rand * M - G)
  const W = Math.ceil(h)
  return W - 1
}
