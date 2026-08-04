import type { FooterLink } from '@/features/footer/links'
import IconBrandGithub from '~icons/tabler/brand-github'
import IconShield from '~icons/tabler/shield'
import IconFileText from '~icons/tabler/file-text'
import IconShieldLock from '~icons/tabler/shield-lock'

export const FOOTER_LINKS: readonly FooterLink[] = [
  {
    icon: IconBrandGithub,
    label: 'GitHub',
    link: 'https://github.com/Eg0r0k'
  },
  {
    icon: IconShield,
    label: 'Security',
    link: '/security-policy'
  },
  {
    icon: IconFileText,
    label: 'Terms',
    // Absolute, like its neighbours: a bare 'terms' resolves RELATIVE to
    // whatever route the footer happens to be under, so the same entry pointed
    // somewhere different on every page.
    link: '/terms'
  },
  {
    icon: IconShieldLock,
    label: 'Privacy',
    link: '/privacy-policy'
  }
]
