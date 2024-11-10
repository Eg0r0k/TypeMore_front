export type Quote = {
  id: number
  text: string
  source: string
  length: number
  textSplit?: string[]
}
export type QuoteWithTextSplit = Quote & {
  textSplit: string[]
}
export type QuoteData = {
  language: string
  quotes: Quote[]
}

export type LanguageObj = {
  name: string
  rightToleft: boolean
  words: string[]
  bcp47?: string
}
