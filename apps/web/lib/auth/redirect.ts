const MAX_REDIRECT_PATH_LENGTH = 2_048

export function safeRedirectPath(value: string | null | undefined, fallback = '/') {
  const path = String(value || '').trim()
  if (!path || path.length > MAX_REDIRECT_PATH_LENGTH) return fallback
  if (!path.startsWith('/') || path.startsWith('//')) return fallback

  try {
    const parsed = new URL(path, 'https://dnd-scribe.invalid')
    if (parsed.origin !== 'https://dnd-scribe.invalid') return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}
