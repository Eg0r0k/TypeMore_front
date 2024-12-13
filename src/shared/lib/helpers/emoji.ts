export interface Emoji {
  value: string
  icon: string
  text: string
}
//? Maby made it JSON?
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
    icon: 'https://cdn.discordapp.com/emojis/1140791401618092063.webp?v=1&animated=true',
    text: 'LICKING'
  }
]
export const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
export const parseEmojis = (text: string): string => {
  let parsedText = escapeHtml(text)
  emojis.forEach((emoji) => {
    const regex = new RegExp(`:${emoji.value}:`, 'g')
    parsedText = parsedText.replace(
      regex,
      `<img draggable="false" 
    style="
    max-width: 1.5rem;
    max-height: 1.5rem;
    user-select: none;
    display: inline-flex;
    width: 100%;
    height: auto;"
    src="${emoji.icon}" alt="${emoji.text}" />`
    )
  })

  return parsedText
}
