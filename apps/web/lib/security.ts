export function boundedText(value: string | null | undefined, maxLength: number) {
  const normalized = String(value ?? '').trim()
  if (!Number.isInteger(maxLength) || maxLength < 0) throw new Error('Limite de texto inválido.')
  return normalized.length <= maxLength ? normalized : null
}

export function isSameOriginMutation(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return false

  try {
    const parsedOrigin = new URL(origin).origin
    const requestOrigin = new URL(request.url).origin
    return parsedOrigin === requestOrigin
  } catch {
    return false
  }
}
