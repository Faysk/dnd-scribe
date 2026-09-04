'use client'

import type { MouseEvent } from 'react'

const CONTENT_ID = 'content'

export function SkipLink() {
  function focusContent(event: MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById(CONTENT_ID)
    if (!target) return

    event.preventDefault()

    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: 'start' })

    const hash = `#${CONTENT_ID}`
    if (window.location.hash !== hash) {
      window.history.replaceState(window.history.state, '', hash)
    }
  }

  return (
    <a
      className="fixed left-3 top-3 z-50 -translate-y-24 rounded-sm bg-accent-strong px-3 py-2 text-sm font-semibold text-accent-contrast transition-transform focus:translate-y-0"
      href="#content"
      onClick={focusContent}
    >
      Pular para o conteúdo
    </a>
  )
}
