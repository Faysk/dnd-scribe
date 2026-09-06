import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const alt = 'TDA — Tem Dado Aqui — Rolamos dados. Guardamos os dados.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpenGraphImage() {
  const mark = await readFile(path.join(process.cwd(), 'public/brand/tda-mark-black.svg'))
  const brandMark = `data:image/svg+xml;base64,${mark.toString('base64')}`
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          background: '#f7f7f5',
          color: '#0a0a0a',
          padding: '72px 84px',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 64 }}>
          {/* biome-ignore lint/performance/noImgElement: ImageResponse renders SVG markup, not a browser image. */}
          <img alt="" height={330} src={brandMark} width={330} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 132, fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 0.9 }}>TDA</div>
            <div style={{ marginTop: 24, fontSize: 46, fontWeight: 600 }}>Tem Dado Aqui</div>
            <div style={{ marginTop: 34, fontSize: 28, color: '#666666' }}>
              Rolamos dados. Guardamos os dados.
            </div>
            <div style={{ marginTop: 18, fontSize: 22, color: '#888888' }}>dnd.faysk.dev</div>
          </div>
        </div>
      </div>
    ),
    size,
  )
}
