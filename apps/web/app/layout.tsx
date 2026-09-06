import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { LegacyHashBridge } from '@/components/shell/legacy-hash-bridge'
import { SkipLink } from '@/components/shell/skip-link'
import { THEME_STORAGE_KEY } from '@/lib/config'

import './globals.css'

const SITE_URL = 'https://dnd.faysk.dev'
const SITE_NAME = 'TDA — Tem Dado Aqui'
const SITE_DESCRIPTION =
  'Sessões, personagens, histórias e memórias da nossa campanha. Rolamos dados. Guardamos os dados.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `%s · TDA`,
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: '/brand/tda-icon-duck-black.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: light)' },
      { url: '/brand/tda-icon-duck-white.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: dark)' },
    ],
    shortcut: '/brand/tda-icon-duck-black.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [{ url: '/opengraph-image', alt: SITE_DESCRIPTION }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ['/opengraph-image'],
  },
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
