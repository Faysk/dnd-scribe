import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/class-names'

export type StatusTone = 'accent' | 'success' | 'danger' | 'neutral'

type StatusPillProps = HTMLAttributes<HTMLSpanElement> &
  Readonly<{
    tone?: StatusTone
  }>

const dotStyles: Record<StatusTone, string> = {
  accent: 'bg-accent-strong',
  success: 'bg-success',
  danger: 'bg-danger',
  neutral: 'bg-foreground-muted',
}

export function StatusPill({
  children,
  className,
  tone = 'neutral',
  ...props
}: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-8 items-center gap-2 rounded-full border border-border-subtle bg-canvas-subtle px-3 font-ui text-xs font-medium text-foreground-soft',
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className={cn('size-2 rounded-full', dotStyles[tone])} />
      {children}
    </span>
  )
}
