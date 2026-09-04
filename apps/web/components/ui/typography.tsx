import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/class-names'

type HeadingProps = HTMLAttributes<HTMLHeadingElement>
type ParagraphProps = HTMLAttributes<HTMLParagraphElement>

export function Eyebrow({ className, ...props }: ParagraphProps) {
  return (
    <p
      className={cn(
        'm-0 font-ui text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-accent',
        className,
      )}
      {...props}
    />
  )
}

export function DisplayTitle({ className, ...props }: HeadingProps) {
  return (
    <h1
      className={cn(
        'm-0 font-display text-[clamp(2.75rem,8vw,5.25rem)] font-normal leading-[0.96] tracking-[-0.045em] text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function SectionTitle({ className, ...props }: HeadingProps) {
  return (
    <h2
      className={cn(
        'm-0 font-display text-[clamp(1.75rem,4vw,2.75rem)] font-normal leading-[1.02] tracking-[-0.03em] text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function BodyCopy({ className, ...props }: ParagraphProps) {
  return (
    <p
      className={cn(
        'm-0 font-body text-[clamp(1.0625rem,2vw,1.25rem)] leading-[1.7] text-foreground-soft',
        className,
      )}
      {...props}
    />
  )
}

export function MetaText({ className, ...props }: ParagraphProps) {
  return (
    <p
      className={cn('m-0 font-ui text-xs leading-5 text-foreground-muted', className)}
      {...props}
    />
  )
}
