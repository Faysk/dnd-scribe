'use client'

import { useEffect, useState } from 'react'

import { THEME_STORAGE_KEY } from '@/lib/config'

type ResolvedTheme = 'light' | 'dark'

function readStoredTheme(): ResolvedTheme | null {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(THEME_STORAGE_KEY)
  return value === 'light' || value === 'dark' ? value : null
}

function resolveSystemTheme(media: MediaQueryList): ResolvedTheme {
  return media.matches ? 'dark' : 'light'
}

function SunIcon() {
  return (
    <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.72 5.28l-1.42 1.42M6.7 17.3l-1.42 1.42M18.72 18.72l-1.42-1.42M6.7 6.7 5.28 5.28" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 24 24">
      <path d="M20 15.1A8.6 8.6 0 0 1 8.9 4a8.6 8.6 0 1 0 11.1 11.1Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ResolvedTheme>('dark')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const stored = readStoredTheme()

    if (stored) {
      document.documentElement.dataset.theme = stored
      setTheme(stored)
    } else {
      document.documentElement.removeAttribute('data-theme')
      setTheme(resolveSystemTheme(media))
    }

    setReady(true)

    function handleSystemChange() {
      if (readStoredTheme()) return
      setTheme(resolveSystemTheme(media))
    }

    media.addEventListener('change', handleSystemChange)
    return () => media.removeEventListener('change', handleSystemChange)
  }, [])

  function toggleTheme() {
    const next: ResolvedTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
    window.localStorage.setItem(THEME_STORAGE_KEY, next)
  }

  const dark = theme === 'dark'

  return (
    <button
      aria-checked={dark}
      aria-label="Tema escuro"
      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-border bg-surface p-1 shadow-sm transition-[background-color,border-color,opacity] duration-200 hover:border-accent/60 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-accent-strong ${ready ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      onClick={toggleTheme}
      role="switch"
      title={dark ? 'Tema escuro — clique para usar claro' : 'Tema claro — clique para usar escuro'}
      type="button"
    >
      <span
        aria-hidden="true"
        className={`grid size-6 place-items-center rounded-full bg-foreground text-canvas shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${dark ? 'translate-x-6' : 'translate-x-0'}`}
      >
        {dark ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  )
}
