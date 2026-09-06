'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/action'

const COPY_FEEDBACK_MS = 2_000

type SessionShareActionsProps = Readonly<{
  title: string
  description: string
}>

function currentUrl() {
  return window.location.href.split('#')[0]
}

export function SessionShareActions({ title, description }: SessionShareActionsProps) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = currentUrl()

    if (navigator.share) {
      try {
        await navigator.share({ title, text: description, url })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
    } catch {
      window.prompt('Copie o link da sessão:', url)
    }
  }

  function shareOnWhatsApp() {
    const url = currentUrl()
    const text = [title, description, url].filter(Boolean).join('\n\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="mt-6 flex flex-wrap gap-2" aria-label="Compartilhar sessão">
      <Button onClick={share} size="sm" variant="secondary">
        {copied ? 'Link copiado' : 'Compartilhar sessão'}
      </Button>
      <Button onClick={shareOnWhatsApp} size="sm" variant="tertiary">
        WhatsApp
      </Button>
    </div>
  )
}
