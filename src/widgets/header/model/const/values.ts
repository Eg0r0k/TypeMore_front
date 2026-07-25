import type { HeaderLink } from '../../types/links'
import IconKeyboard from '~icons/tabler/keyboard'
import IconChartBar from '~icons/tabler/chart-bar'
import IconNetwork from '~icons/tabler/network'

export const NAV_LINKS: readonly HeaderLink[] = [
  {
    icon: IconKeyboard,
    label: 'Game',
    link: '/'
  },
  {
    icon: IconChartBar,
    label: 'Leaderbord',
    link: '/'
  },
  {
    icon: IconNetwork,
    label: 'Servers',
    link: '/servers'
  }
]
