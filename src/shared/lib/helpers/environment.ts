// Adapted from https://github.com/morethanwords/tweb/blob/master/src/environment/userAgent.ts
const ctx = typeof window !== 'undefined' ? window : self

export const USER_AGENT = navigator ? navigator.userAgent : null

export const IS_CHROMIUM = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor)

// https://stackoverflow.com/a/58065241
export const IS_APPLE_MOBILE =
  (/iPad|iPhone|iPod/.test(navigator.platform) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
  !('MSStream' in ctx)

export const IS_SAFARI =
  !!('safari' in ctx) ||
  !!(
    USER_AGENT &&
    (/\b(iPad|iPhone|iPod)\b/.test(USER_AGENT) ||
      (!!USER_AGENT.match('Safari') && !USER_AGENT.match('Chrome')))
  )

export const IS_MOBILE_SAFARI = IS_SAFARI && IS_APPLE_MOBILE

export const IS_MOBILE =
  (navigator.maxTouchPoints === undefined || navigator.maxTouchPoints > 0) &&
  navigator.userAgent.search(
    /iOS|iPhone OS|Android|BlackBerry|BB10|Series ?[64]0|J2ME|MIDP|opera mini|opera mobi|mobi.+Gecko|Windows Phone/i
  ) !== -1

export const IS_TOUCH_SUPPORTED =
  'ontouchstart' in window ||
  // @ts-expect-error DocumentTouch is not typed
  !!(window.DocumentTouch && document instanceof DocumentTouch)

export const IS_OVERLAY_SCROLL_SUPPORTED =
  IS_MOBILE || (!IS_CHROMIUM && (!IS_SAFARI || IS_MOBILE_SAFARI))
