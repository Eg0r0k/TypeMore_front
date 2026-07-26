/** Dictionaries domain — public surface. */
export { dictionaryKeys } from './keys'
export {
  dictionaryCatalogueQueryOptions,
  languageKeysQueryOptions,
  languageNamesQueryOptions,
  dictionaryBodyQueryOptions,
  dictionaryBodyByHashQueryOptions,
  loadDictionaryCatalogue,
  loadLanguages,
  loadDictionaryBody,
  loadDictionaryBodyByHash
} from './queries'
export { DictionarySchema, DictionaryCatalogueSchema, DictionaryBodySchema } from './schemas'
export type { DictionaryInfo, DictionaryCatalogue, DictionaryBody } from './schemas'
