'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/action'
import { THEME_STORAGE_KEY } from '@/lib/config'

type ThemePreference = 'system' | 'light' | 'dark'

const order: ThemePreference[] = ['system', 'light', 'dark']
const labels: Record<ThemePreference, string> = {
  system: 'sistema',
  light: 'claro',
  dark: 'escuro',
}

function readPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  const value = window.localStorage.getItem(THEME_STORAGE_KEY)
  return value === 'light' || value === 'dark' ? value : 'system'
}

function applyPreference(preference: ThemePreference) {
  const root = document.documentElement
  if (preference === 'system') root.removeAttribute('data-theme')
  else root.dataset.theme = preference
}

export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>('system')

  useEffect(() => {
    const stored = readPreference()
    setPreference(stored)
    applyPreference(stored)
  }, [])

  function cycleTheme() {
    const next = order[(order.indexOf(preference) + 1) % order.length]
    setPreference(next)
    applyPreference(next)
    if (next === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, next)
  }

  return (
    <Button
      aria-label={`Tema atual: ${labels[preference]}. Alterar tema.`}
      className="min-h-9 rounded-md px-3 text-xs font-medium"
      onClick={cycleTheme}
      size="sm"
      variant="secondary"
    >
      <span aria-hidden="true">{preference === 'dark' ? '☾' : preference === 'light' ? '☀' : '◐'}</span>
      <span>{labels[preference]}</span>
    </Button>
  )
}
