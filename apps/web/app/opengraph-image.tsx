import { ImageResponse } from 'next/og'

export const alt = 'TDA — Tem Dado Aqui — Rolamos dados. Guardamos os dados.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BRAND_MARK = 'https://dnd.faysk.dev/brand/tda-mark-black.svg'

export default function OpenGraphImage() {
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
          <img alt="" height="330" src={BRAND_MARK} width="330" />
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
