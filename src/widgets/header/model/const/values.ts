import type { HeaderLink } from '@/features/header/navigation'
import IconKeyboard from '~icons/tabler/keyboard'
import IconChartBar from '~icons/tabler/chart-bar'
import IconNetwork from '~icons/tabler/network'
import IconUsers from '~icons/tabler/users'

export const NAV_LINKS: readonly HeaderLink[] = [
  {
    icon: IconKeyboard,
    label: 'Game',
    link: '/'
  },
  {
    icon: IconChartBar,
    label: 'Leaderboards',
    link: '/boards'
  },
  {
    icon: IconNetwork,
    label: 'Servers',
    link: '/servers'
  },
  {
    icon: IconUsers,
    label: 'Friends',
    link: '/friends'
  }
]
