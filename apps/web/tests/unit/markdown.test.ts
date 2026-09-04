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

  it('não cria href para protocolos perigosos', () => {
    const html = renderToStaticMarkup(MarkdownContent({
      markdown: '[armadilha](javascript:alert(1))',
    }))

    expect(html).toContain('armadilha')
    expect(html).not.toContain('javascript:')
  })
})
