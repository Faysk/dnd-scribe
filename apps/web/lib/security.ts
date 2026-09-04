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
    const requestUrl = new URL(request.url)
    const allowedOrigins = new Set([requestUrl.origin])
    const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host')
    if (forwardedHost) {
      const forwardedProto = request.headers.get('x-forwarded-proto') || requestUrl.protocol.replace(':', '')
      allowedOrigins.add(`${forwardedProto}://${forwardedHost}`)
    }
    return allowedOrigins.has(parsedOrigin)
  } catch {
    return false
  }
}
