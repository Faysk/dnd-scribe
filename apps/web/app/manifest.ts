import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TDA — Tem Dado Aqui',
    short_name: 'TDA',
    description: 'Sessões, personagens, histórias e memórias da nossa campanha. Rolamos dados. Guardamos os dados.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    lang: 'pt-BR',
    icons: [
      {
        src: '/brand/tda-icon-duck-black.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
