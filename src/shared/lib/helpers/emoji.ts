export interface Emoji {
  /** The `:token:` that travels in the message text. */
  value: string
  /** Image URL — remote; nothing about an emoji is bundled. */
  icon: string
  /** Human name: the tooltip, the search target, the fallback when the icon dies. */
  text: string
}

/**
 * The emoji this app knows, and the ONE place to add one.
 *
 * To add: append an entry. `value` is the `:token:` a message carries and must
 * match {@link EMOJI_NAME_PATTERN}; `icon` is a direct image URL (a Discord CDN
 * link works — right-click an emoji → Copy Link); `text` is the tooltip and what
 * the search matches on.
 *
 * The set is shipped, not per-user: a token only means something if the client
 * reading the message has the same list, and chat travels as plain text.
 */
export const emojis: Emoji[] = [
  {
    value: 'sadge',
    icon: 'https://cdn.discordapp.com/emojis/1058080458426032128.png?v=1',
    text: 'Sadge'
  },
  {
    value: 'pepeChill',
    icon: 'https://cdn.discordapp.com/emojis/881471669313630248.webp?v=1',
    text: 'Pepe Chill'
  },
  {
    value: 'Hmm',
    icon: 'https://cdn.discordapp.com/emojis/965268219785019453.webp?v=1',
    text: 'Hmm...'
  },
  {
    value: 'LICKING',
    // `.gif`, not `.webp?animated=true`. The webp form is what Discord's own
    // client asks for and Firefox would not render it — the emoji came out as
    // its alt text instead. The gif is the form every browser takes.
    icon: 'https://cdn.discordapp.com/emojis/1140791401618092063.gif',
    text: 'LICKING'
  }
]

/**
 * What a custom emoji's name may be: exactly what can sit between two colons
 * and be found again. No colon (it would close the token early), no whitespace,
 * and nothing that is a regex metacharacter — `parseEmojis` interpolates the
 * name into a pattern, and this is what makes that safe.
 */
export const EMOJI_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

/** Case-insensitive match on the display name and on the token. */
export const searchEmojis = (list: readonly Emoji[], query: string): Emoji[] => {
  const needle = query.trim().toLowerCase()
  if (needle === '') return [...list]
  return list.filter(
    (emoji) =>
      emoji.text.toLowerCase().includes(needle) || emoji.value.toLowerCase().includes(needle)
  )
}

export const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Renders `:name:` tokens as images. HTML-escapes FIRST, so remote text never
 * reaches `v-html` raw — the substitution below is the only markup that comes
 * out of this function, and the URL and alt it interpolates are escaped too.
 *
 * A name that is not in the list stays the literal `:name:` — which is exactly
 * what a client that has never heard of it should show.
 */
export const parseEmojis = (text: string, list: readonly Emoji[] = emojis): string => {
  let parsedText = escapeHtml(text)
  for (const emoji of list) {
    // The name pattern forbids every regex metacharacter, so the token is safe
    // to interpolate; an entry that somehow got past validation is skipped
    // rather than compiled into a pattern.
    if (!EMOJI_NAME_PATTERN.test(emoji.value)) continue
    const regex = new RegExp(`:${emoji.value}:`, 'g')
    parsedText = parsedText.replace(
      regex,
      /*
       * `display: inline-block` FIRST, and it is not decoration: Tailwind's
       * preflight resets `img` to `display: block`, so an emoji without an
       * explicit inline display starts its own line — three of them in a
       * sentence came out as a column of three.
       *
       * `height` with `width: auto`, and no `width: 100%`. A fixed box clips a
       * BROKEN image down to the first character or two of its alt — which is
       * how a dead icon turned into `:L`. Sized by height, a failed image falls
       * back to its alt at natural width, and the alt is the token the message
       * actually carries, so it reads as what it is.
       */
      `<img draggable="false" referrerpolicy="no-referrer"
    style="
    display: inline-block;
    height: 1.5em;
    width: auto;
    max-height: 1.5rem;
    vertical-align: -0.25em;
    user-select: none;"
    src="${escapeHtml(emoji.icon)}" alt=":${escapeHtml(emoji.value)}:" title="${escapeHtml(emoji.text)}" />`
    )
  }

  return parsedText
}
