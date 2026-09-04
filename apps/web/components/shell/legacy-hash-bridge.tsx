'use client'

import { useEffect } from 'react'

import { legacyHashDestination } from '@/lib/legacy-routes'

export function LegacyHashBridge() {
  useEffect(() => {
    if (window.location.pathname !== '/') return
    const destination = legacyHashDestination(window.location.hash)
    if (!destination) return
    window.location.replace(destination)
  }, [])

  return null
}
