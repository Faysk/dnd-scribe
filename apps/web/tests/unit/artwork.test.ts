import { describe, expect, it } from 'vitest'

import { normalizeArtworkUrl } from '@/lib/artwork'

describe('normalizeArtworkUrl', () => {
  it('aceita apenas hosts de arte conhecidos via HTTPS', () => {
    expect(normalizeArtworkUrl('https://dmrqnbdvbkfqzctcerbx.supabase.co/storage/v1/object/public/covers/a.webp')).toContain('dmrqnbdvbkfqzctcerbx.supabase.co')
    expect(normalizeArtworkUrl('https://dnd.faysk.dev/covers/a.webp')).toContain('dnd.faysk.dev')
    expect(normalizeArtworkUrl('https://raw.githubusercontent.com/Faysk/dnd-scribe/main/art/a.png')).toContain('raw.githubusercontent.com')
  })

  it('rejeita origem desconhecida, HTTP e credenciais embutidas', () => {
    expect(normalizeArtworkUrl('https://evil.example/a.png')).toBe('')
    expect(normalizeArtworkUrl('http://dnd.faysk.dev/a.png')).toBe('')
    expect(normalizeArtworkUrl('https://user:pass@dnd.faysk.dev/a.png')).toBe('')
  })
})
