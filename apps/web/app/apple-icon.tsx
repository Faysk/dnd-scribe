import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default async function AppleIcon() {
  const icon = await readFile(path.join(process.cwd(), 'public/brand/tda-icon-duck-white.svg'))
  const duckIcon = `data:image/svg+xml;base64,${icon.toString('base64')}`
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
        {/* biome-ignore lint/performance/noImgElement: ImageResponse renders SVG markup, not a browser image. */}
        <img alt="" height={132} src={duckIcon} width={132} />
      </div>
    ),
    size,
  )
}
