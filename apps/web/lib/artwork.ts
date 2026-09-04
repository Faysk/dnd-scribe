export const ARTWORK_HOSTS = [
  'dmrqnbdvbkfqzctcerbx.supabase.co',
  'dnd.faysk.dev',
  'raw.githubusercontent.com',
] as const

const allowedArtworkHosts = new Set<string>(ARTWORK_HOSTS)

export function normalizeArtworkUrl(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return ''

  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'https:') return ''
    if (parsed.username || parsed.password) return ''
    if (!allowedArtworkHosts.has(parsed.hostname)) return ''
    return parsed.toString()
  } catch {
    return ''
  }
}
