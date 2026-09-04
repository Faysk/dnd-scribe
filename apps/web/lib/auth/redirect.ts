export function safeRedirectPath(value: string | null | undefined, fallback = '/') {
  if (!value) return fallback
  if (!value.startsWith('/') || value.startsWith('//')) return fallback

  try {
    const parsed = new URL(value, 'https://dnd-scribe.invalid')
    if (parsed.origin !== 'https://dnd-scribe.invalid') return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}
