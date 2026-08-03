import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Avatar } from './Avatar.vue'
export { default as AvatarFallback } from './AvatarFallback.vue'
export { default as AvatarImage } from './AvatarImage.vue'
export { default as UserAvatar } from './UserAvatar.vue'

/**
 * The avatar surface (shadcn-vue's `avatar`, on this app's tokens).
 *
 * `@container` is the load-bearing part: it makes the circle a container-query
 * context, so everything inside can size itself in `cqw` — a percentage of the
 * AVATAR, not of the root font size. That is what lets one component serve a
 * 24px chip in the header and a 96px portrait on /profile with the initials
 * staying proportional in both, including when the size comes from a class, a
 * parent, or a percentage the caller computes at runtime.
 *
 * `size` is the convenient path; any width/height class the caller passes wins
 * over it (tailwind-merge), so `<Avatar class="size-[72px]" />` is as valid as
 * `<Avatar size="lg" />`.
 */
export const avatarVariant = cva(
  '@container relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden bg-sub-alt text-text',
  {
    variants: {
      size: {
        xs: 'size-6',
        sm: 'size-8',
        md: 'size-10',
        lg: 'size-16',
        xl: 'size-24'
      },
      shape: {
        circle: 'rounded-full',
        // The radius token is capped at 6px app-wide, so a "square" avatar is
        // the same soft rectangle every other surface here has.
        square: 'rounded-md'
      }
    },
    defaultVariants: {
      size: 'md',
      shape: 'circle'
    }
  }
)

export type AvatarVariants = VariantProps<typeof avatarVariant>
export type AvatarSize = NonNullable<AvatarVariants['size']>
export type AvatarShape = NonNullable<AvatarVariants['shape']>
