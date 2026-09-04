export function legacyHashDestination(hash: string) {
  const value = String(hash || '').trim()
  const match = /^#\/sessao\/([^/]+?)(?:\/(resumo))?\/?$/i.exec(value)
  if (!match) return null

  let sourceSessionId = match[1]
  try {
    sourceSessionId = decodeURIComponent(sourceSessionId)
  } catch {
    return null
  }

  sourceSessionId = sourceSessionId.trim()
  if (!sourceSessionId || sourceSessionId.length > 220) return null
  const encoded = encodeURIComponent(sourceSessionId)
  return match[2] ? `/sessoes/${encoded}` : `/sessoes/${encoded}/transcricao`
}
