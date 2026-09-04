import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { LegacyHashBridge } from '@/components/shell/legacy-hash-bridge'
import { SkipLink } from '@/components/shell/skip-link'
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
        <SkipLink />
        {children}
      </body>
    </html>
  )
}
