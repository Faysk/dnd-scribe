import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

const DUCK_ICON = 'https://dnd.faysk.dev/brand/tda-icon-duck-white.svg'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000000',
          borderRadius: 36,
        }}
      >
        <img alt="" height="132" src={DUCK_ICON} width="132" />
      </div>
    ),
    size,
  )
}
