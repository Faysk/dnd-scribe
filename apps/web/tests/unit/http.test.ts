import { describe, expect, it } from 'vitest'

import { readBoundedResponseJson, readBoundedResponseText, ResponseBodyLimitError } from '../../lib/http'

describe('bounded upstream response readers', () => {
  it('reads text and JSON inside the configured byte budget', async () => {
    await expect(readBoundedResponseText(new Response('memória'), 32)).resolves.toBe('memória')
    await expect(readBoundedResponseJson(new Response('{"ok":true}'), 32)).resolves.toEqual({ ok: true })
  })

  it('rejects content-length and streamed bodies above the budget', async () => {
    const declared = new Response('x', { headers: { 'content-length': '100' } })
    await expect(readBoundedResponseText(declared, 10)).rejects.toBeInstanceOf(ResponseBodyLimitError)

    const streamed = new Response('é'.repeat(10))
    await expect(readBoundedResponseText(streamed, 10)).rejects.toBeInstanceOf(ResponseBodyLimitError)
  })

  it('rejects invalid limits and malformed JSON', async () => {
    await expect(readBoundedResponseText(new Response('x'), 0)).rejects.toThrow('Limite de resposta inválido')
    await expect(readBoundedResponseJson(new Response('{'), 32)).rejects.toBeInstanceOf(SyntaxError)
  })
})
