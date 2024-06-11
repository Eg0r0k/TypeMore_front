const G = 0.5772156649

export const logRandomIndex = (arrayLen: number): number => {
  const len = arrayLen
  const M = Math.log(len) + G
  const rand = Math.random()
  const h = Math.exp(rand * M - G)
  const W = Math.ceil(h)
  return W - 1
}

export const getColorWithOpacity = (color: string, opacity: number) => {
  const hex = color.replace('#', '')
  const bigint = parseInt(hex, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}
