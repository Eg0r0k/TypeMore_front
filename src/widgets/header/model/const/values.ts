import { HeaderLink } from '../../types/links'

export const NAV_LINKS: readonly HeaderLink[] = [
  {
    iconName: 'material-symbols:keyboard-outline',
    label: 'Game',
    link: '/'
  },
  {
    iconName: 'material-symbols:leaderboard-outline-rounded',
    label: 'Leaderbord',
    link: '/'
  },
  {
    iconName: 'solar:settings-bold',
    label: 'Settings',
    link: '/settings'
  },
  {
    iconName: 'icon-park-solid:network-tree',
    label: 'Servers',
    link: '/servers'
  },
  {
    iconName: 'fluent:paint-brush-24-filled',
    label: 'Themes',
    link: '/themes'
  }
]
