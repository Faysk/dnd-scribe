import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/class-names'

export type SurfaceTone = 'default' | 'elevated' | 'subtle'

type SurfaceProps = HTMLAttributes<HTMLElement> &
  Readonly<{
    tone?: SurfaceTone
  }>

const toneStyles: Record<SurfaceTone, string> = {
  default: 'border-border bg-surface',
  elevated: 'border-border bg-surface-elevated shadow-elevated',
  subtle: 'border-border-subtle bg-canvas-subtle',
}

export function Surface({ className, tone = 'default', ...props }: SurfaceProps) {
  return (
    <section
      className={cn('rounded-lg border text-foreground', toneStyles[tone], className)}
      {...props}
    />
  )
}
