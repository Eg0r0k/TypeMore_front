import { LanguageObj } from '@/shared/constants/type'

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

export const getLangList = async () => {
  try {
    const langList = await cachedFetchJson<string[]>('/static/languages/list.json')
    return langList
  } catch (e) {
    throw new Error('Lang list JSON load failed')
  }
}

export const getLanguage = (lang: string): Promise<LanguageObj> => {
  // console.debug(`Getting language:  ${lang}`)
  try {
    const currentLang = cachedFetchJson<LanguageObj>(`./static/${lang}.json`)
    return currentLang
  } catch (e) {
    throw Error(`No expected lang,${lang}`)
  }
}
