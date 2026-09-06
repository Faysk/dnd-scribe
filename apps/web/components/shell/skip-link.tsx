'use client'

import type { MouseEvent } from 'react'

const CONTENT_ID = 'content'

export function SkipLink() {
  function focusContent(event: MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById(CONTENT_ID)
    if (!target) return

    event.preventDefault()

    const hash = `#${CONTENT_ID}`
    if (window.location.hash !== hash) {
      window.history.replaceState(window.history.state, '', hash)
    }

    target.scrollIntoView({ block: 'start' })
    target.focus({ preventScroll: true })
  }

  return (
    // biome-ignore lint/a11y/useValidAnchor: Real fragment navigation with an explicit focus fix for keyboard users.
    <a
      className="fixed left-3 top-3 z-50 -translate-y-24 rounded-sm bg-accent-strong px-3 py-2 text-sm font-semibold text-accent-contrast transition-transform focus:translate-y-0"
      href="#content"
      onClick={focusContent}
      tabIndex={0}
    >
      Pular para o conteúdo
    </a>
  )
}
