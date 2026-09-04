import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { LegacyHashBridge } from '@/components/shell/legacy-hash-bridge'
import { THEME_STORAGE_KEY } from '@/lib/config'

import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'DnD Scribe',
    template: '%s · DnD Scribe',
  },
  description: 'Memórias, sessões e transcrições da campanha.',
}

const themeInitScript = `(()=>{try{const k=${JSON.stringify(THEME_STORAGE_KEY)};const v=localStorage.getItem(k);if(v==='light'||v==='dark')document.documentElement.dataset.theme=v;else document.documentElement.removeAttribute('data-theme')}catch{}})()`

type RootLayoutProps = Readonly<{
  children: ReactNode
}>

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <LegacyHashBridge />
        <a className="fixed left-3 top-3 z-50 -translate-y-24 rounded-sm bg-accent-strong px-3 py-2 text-sm font-semibold text-accent-contrast transition-transform focus:translate-y-0" href="#content">Pular para o conteúdo</a>
        {children}
      </body>
    </html>
  )
}
