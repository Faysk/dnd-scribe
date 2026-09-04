import Link from 'next/link'
import type { ButtonHTMLAttributes, ComponentProps } from 'react'

import { cn } from '@/lib/class-names'

export type ActionVariant = 'primary' | 'secondary' | 'tertiary'
export type ActionSize = 'sm' | 'md'

type ActionStyleOptions = Readonly<{
  variant?: ActionVariant
  size?: ActionSize
  className?: string
}>

const baseStyles =
  'inline-flex items-center justify-center gap-2 rounded-md border font-ui font-semibold no-underline transition-[background-color,border-color,color,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-accent-strong disabled:pointer-events-none disabled:opacity-50'

const variantStyles: Record<ActionVariant, string> = {
  primary:
    'border-accent-strong bg-accent-strong text-accent-contrast hover:-translate-y-px hover:border-accent hover:bg-accent',
  secondary:
    'border-border bg-surface text-foreground hover:border-accent/60 hover:bg-surface-hover',
  tertiary:
    'border-transparent bg-transparent text-foreground-soft hover:bg-accent-muted hover:text-foreground',
}

const sizeStyles: Record<ActionSize, string> = {
  sm: 'min-h-9 px-3 text-xs',
  md: 'min-h-11 px-4 text-sm',
}

export function actionStyles({
  variant = 'secondary',
  size = 'md',
  className,
}: ActionStyleOptions = {}) {
  return cn(baseStyles, variantStyles[variant], sizeStyles[size], className)
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ActionStyleOptions

export function Button({
  className,
  size = 'md',
  type = 'button',
  variant = 'secondary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={actionStyles({ className, size, variant })}
      type={type}
      {...props}
    />
  )
}

type ActionLinkProps = ComponentProps<typeof Link> & ActionStyleOptions

export function ActionLink({
  className,
  size = 'md',
  variant = 'secondary',
  ...props
}: ActionLinkProps) {
  return <Link className={actionStyles({ className, size, variant })} {...props} />
}
