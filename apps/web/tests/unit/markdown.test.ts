import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MarkdownContent } from '../../components/content/markdown'

describe('MarkdownContent', () => {
  it('renderiza Markdown no servidor sem executar HTML bruto', () => {
    const html = renderToStaticMarkup(MarkdownContent({
      markdown: '# Memória\n\n**forte** <script>alert(1)</script>',
    }))

    expect(html).toContain('Memória')
    expect(html).toContain('<strong')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('não cria href para protocolos perigosos ou caminhos ambíguos', () => {
    const html = renderToStaticMarkup(MarkdownContent({
      markdown: '[js](javascript:alert(1)) [slash](//evil.example/path) [backslash](/\\evil.example/path)',
    }))

    expect(html).toContain('js')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('href="//evil.example')
    expect(html).not.toContain('evil.example/path')
  })

  it('preserva links relativos e HTTPS normais', () => {
    const html = renderToStaticMarkup(MarkdownContent({
      markdown: '[sessão](/sessoes/abc?x=1#memoria) [site](https://example.com/path)',
    }))

    expect(html).toContain('href="/sessoes/abc?x=1#memoria"')
    expect(html).toContain('href="https://example.com/path"')
  })

  it('aceita imagens somente das origens auditadas', () => {
    const allowed = renderToStaticMarkup(MarkdownContent({
      markdown: '![capa](https://dmrqnbdvbkfqzctcerbx.supabase.co/storage/v1/object/public/session-artwork/a.webp)',
    }))
    const rejected = renderToStaticMarkup(MarkdownContent({
      markdown: '![pixel](https://tracker.example/pixel.gif)',
    }))

    expect(allowed).toContain('<img')
    expect(allowed).toContain('referrerPolicy="no-referrer"')
    expect(rejected).not.toContain('<img')
    expect(rejected).toContain('[pixel]')
  })
})
