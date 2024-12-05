import { FooterLink } from '../types/links'

export const FOOTER_LINKS: readonly FooterLink[] = [
  {
    iconName: 'mingcute:github-fill',
    label: 'GitHub',
    isBlank: true,
    link: 'https://github.com/Eg0r0k/TypeMore_front'
  },
  {
    iconName: 'healthicons:security-worker',
    label: 'Security',
    isBlank: false,
    link: '/security-policy'
  },
  {
    iconName: 'fluent:document-16-filled',
    label: 'Terms',
    isBlank: false,
    link: '/terms'
  },
  {
    iconName: 'mdi:secure',
    label: 'Privacy',
    isBlank: false,
    link: '/privacy-policy'
  }
]
