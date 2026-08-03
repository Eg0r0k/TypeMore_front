/** Dictionaries domain — public surface. */
export { dictionaryKeys } from './keys'
export {
  dictionaryCatalogueQueryOptions,
  languageNamesQueryOptions,
  dictionaryBodyByHashQueryOptions,
  loadDictionaryCatalogue,
  loadDictionaryBody
} from './queries'
export { DictionarySchema, DictionaryCatalogueSchema, DictionaryBodySchema } from './schemas'
export type { DictionaryInfo, DictionaryCatalogue, DictionaryBody } from './schemas'
