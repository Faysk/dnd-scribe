export class ResponseBodyLimitError extends Error {
  constructor(message = 'Resposta excede o limite permitido.') {
    super(message)
    this.name = 'ResponseBodyLimitError'
  }
}

function assertMaxBytes(maxBytes: number) {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new Error('Limite de resposta inválido.')
  }
}

export async function readBoundedResponseText(response: Response, maxBytes: number) {
  assertMaxBytes(maxBytes)

  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ResponseBodyLimitError()
  }

  if (!response.body) return ''

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const chunks: string[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue

    received += value.byteLength
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new ResponseBodyLimitError()
    }
    chunks.push(decoder.decode(value, { stream: true }))
  }

  chunks.push(decoder.decode())
  return chunks.join('')
}

export async function readBoundedResponseJson(response: Response, maxBytes: number): Promise<unknown> {
  const text = await readBoundedResponseText(response, maxBytes)
  if (!text.trim()) return null
  return JSON.parse(text) as unknown
}
