import { LanguageObj } from '@/shared/constants/type'
/**
 * Fetches JSON data from a given URL.
 * @template T - The expected type of the JSON response.
 * @param url - The URL to fetch data from.
 * @returns A promise that resolves to the JSON data.
 * @throws Will throw an error if the URL is invalid or the fetch fails.
 */
export async function fetchJson<T>(url: string): Promise<T> {
  try {
    if (!url) {
      throw new Error(`Invalid URL: '${url}'`)
    }
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Failed to fetch: ${res.status} ${res.statusText} | URL: ${url}`)
    }
    return (await res.json()) as T
  } catch (e) {
    console.error(`Error fetching JSON: ${url}`, e)
    throw e
  }
}
/**
 * Memoizes an asynchronous function, caching its results based on provided arguments.
 * 
 * @template P - The type of the key used for caching.
 * @template T - The function type that returns a promise.
 * @param  fn - The asynchronous function to memoize.
 * @param {(...args: Parameters<T>) => P} [getKey] - Optional function to generate a cache key from the arguments.
 * @returns {T}  The memoized function.
 */
export function memoizeAsync<P, T extends <B>(...args: P[]) => Promise<B>>(
  fn: T,
  getKey?: (...args: Parameters<T>) => P
): T {
  const cache = new Map<P, Promise<ReturnType<T>>>()

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const key = getKey ? getKey.apply(args) : (args[0] as P)

    if (cache.has(key)) {
      const ret = await cache.get(key)
      if (ret !== undefined) {
        return ret as ReturnType<T>
      }
    }

    // eslint-disable-next-line prefer-spread
    const result = fn.apply(null, args) as Promise<ReturnType<T>>
    cache.set(key, result)

    return result
  }) as T
}

export const cachedFetchJson = memoizeAsync<string, typeof fetchJson>(fetchJson)
/**
 * Fetches a list of available languages.
 * 
 * @returns A promise that resolves to an array of language codes.
 * @throws Will throw an error if the language list JSON fails to load.
 */
export const getLangList = async () => {
  try {
    const langList = await cachedFetchJson<string[]>('/static/languages/list.json')
    return langList
  } catch (e) {
    throw new Error('Lang list JSON load failed')
  }
}
/**
 * Fetches the language object for a given language code.
 * 
 * @param lang - The language code.
 * @returns A promise that resolves to the language object.
 * @throws Will throw an error if the language JSON fails to load.
 */
export const getLanguage = (lang: string): Promise<LanguageObj> => {
  try {
    const currentLang = cachedFetchJson<LanguageObj>(`./static/languages/${lang}.json`)
    return currentLang
  } catch (e) {
    throw Error(`No expected lang,${lang}`)
  }
}
