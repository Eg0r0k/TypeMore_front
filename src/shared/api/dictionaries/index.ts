/** Dictionaries domain — public surface. */
export { dictionaryKeys } from './keys'
export {
  dictionaryCatalogueQueryOptions,
  languagesQueryOptions,
  dictionaryBodyQueryOptions,
  dictionaryBodyByHashQueryOptions,
  loadDictionaryCatalogue,
  loadLanguages,
  loadDictionaryBody,
  loadDictionaryBodyByHash
} from './queries'

export type { DictionaryInfo, DictionaryCatalogue, DictionaryBody } from './schemas'
