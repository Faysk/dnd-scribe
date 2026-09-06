// biome-ignore-all lint/suspicious/noArrayIndexKey: Stateless server-rendered Markdown positions represent immutable document nodes.
import type { ReactNode } from 'react'
import { marked } from 'marked'

import { normalizeArtworkUrl } from '../../lib/artwork'

type MarkdownToken = Readonly<{
  type?: string
  raw?: string
  text?: string
  depth?: number
  href?: string
  title?: string | null
  lang?: string
  ordered?: boolean
  start?: number | ''
  tokens?: readonly MarkdownToken[]
  items?: readonly MarkdownToken[]
  header?: readonly MarkdownCell[]
  rows?: readonly (readonly MarkdownCell[])[]
}>

type MarkdownCell = Readonly<{
  tokens?: readonly MarkdownToken[]
  text?: string
}>

const MARKDOWN_BASE_URL = 'https://dnd-scribe.invalid'

function cleanMarkdown(value: string) {
  return value.replace(/^[\uFEFF\u200B-\u200D\u2060]+/, '').trim()
}

function safeLinkHref(value: string | undefined) {
  const href = String(value || '').trim()
  if (!href || href.includes('\\')) return null
  if (href.startsWith('#')) return href

  try {
    if (href.startsWith('/')) {
      const parsed = new URL(href, MARKDOWN_BASE_URL)
      if (parsed.origin !== MARKDOWN_BASE_URL) return null
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    }

    const parsed = new URL(href)
    if (!['https:', 'http:', 'mailto:'].includes(parsed.protocol)) return null
    if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && (parsed.username || parsed.password)) return null
    return parsed.toString()
  } catch {
    return null
  }
}

function safeImageHref(value: string | undefined) {
  return normalizeArtworkUrl(String(value || '').trim())
}

function renderHeading(depth: number, children: ReactNode, key: string) {
  const className = 'font-display tracking-[-0.025em] text-foreground'
  if (depth <= 1) return <h2 className={`${className} mt-12 text-4xl`} key={key}>{children}</h2>
  if (depth === 2) return <h3 className={`${className} mt-10 text-3xl`} key={key}>{children}</h3>
  if (depth === 3) return <h4 className={`${className} mt-8 text-2xl`} key={key}>{children}</h4>
  return <h5 className={`${className} mt-7 text-xl`} key={key}>{children}</h5>
}

function renderCell(cell: MarkdownCell, key: string) {
  return cell.tokens?.length ? renderTokens(cell.tokens, key) : cell.text || ''
}

function renderToken(token: MarkdownToken, key: string): ReactNode {
  const children = token.tokens?.length ? renderTokens(token.tokens, `${key}-child`) : token.text || ''

  switch (token.type) {
    case 'space':
    case 'def':
      return null
    case 'heading':
      return renderHeading(Number(token.depth || 2), children, key)
    case 'paragraph':
      return <p className="mt-5 font-body text-[1.05rem] leading-8 text-foreground-soft" key={key}>{children}</p>
    case 'text':
    case 'escape':
      return <span key={key}>{children}</span>
    case 'strong':
      return <strong className="font-semibold text-foreground" key={key}>{children}</strong>
    case 'em':
      return <em key={key}>{children}</em>
    case 'del':
      return <del className="text-foreground-muted" key={key}>{children}</del>
    case 'codespan':
      return <code className="rounded-sm border border-border-subtle bg-canvas-subtle px-1.5 py-0.5 font-mono text-[0.9em] text-accent-strong" key={key}>{token.text || ''}</code>
    case 'code':
      return (
        <pre className="mt-6 overflow-x-auto rounded-md border border-border bg-canvas-subtle p-5 text-sm leading-6 text-foreground-soft" key={key}>
          <code data-language={token.lang || undefined}>{token.text || ''}</code>
        </pre>
      )
    case 'blockquote':
      return <blockquote className="mt-6 border-l-2 border-accent/60 pl-5 italic text-foreground-soft" key={key}>{children}</blockquote>
    case 'hr':
      return <hr className="my-10 border-0 border-t border-border-subtle" key={key} />
    case 'br':
      return <br key={key} />
    case 'link': {
      const href = safeLinkHref(token.href)
      if (!href) return <span key={key}>{children}</span>
      return <a className="font-medium text-accent-strong underline decoration-accent/40 underline-offset-4 hover:decoration-accent" href={href} key={key}>{children}</a>
    }
    case 'image': {
      const src = safeImageHref(token.href)
      if (!src) return token.text ? <span key={key}>[{token.text}]</span> : null
      return (
        // Summary images use the same audited allowlist as session artwork.
        // biome-ignore lint/performance/noImgElement: Allowlisted Markdown artwork has no known dimensions; preserve natural ratio.
        <img alt={token.text || 'Imagem do resumo da sessão'} className="my-8 h-auto max-h-[720px] w-full rounded-lg border border-border-subtle object-contain" loading="lazy" referrerPolicy="no-referrer" src={src} title={token.title || undefined} key={key} />
      )
    }
    case 'list': {
      const items = token.items || []
      const listChildren = items.map((item, index) => (
        <li className="pl-1" key={`${key}-item-${index}`}>{renderTokens(item.tokens || [], `${key}-item-${index}`)}</li>
      ))
      if (token.ordered) {
        const start = typeof token.start === 'number' ? token.start : undefined
        return <ol className="mt-5 grid list-decimal gap-2 pl-6 font-body text-[1.05rem] leading-8 text-foreground-soft" key={key} start={start}>{listChildren}</ol>
      }
      return <ul className="mt-5 grid list-disc gap-2 pl-6 font-body text-[1.05rem] leading-8 text-foreground-soft" key={key}>{listChildren}</ul>
    }
    case 'list_item':
      return <span key={key}>{children}</span>
    case 'table': {
      const header = token.header || []
      const rows = token.rows || []
      return (
        <div className="mt-7 overflow-x-auto" key={key}>
          <table className="w-full border-collapse font-ui text-sm">
            <thead>
              <tr className="border-b border-border text-left text-foreground">
                {header.map((cell, index) => <th className="px-3 py-3 font-semibold" key={`${key}-h-${index}`}>{renderCell(cell, `${key}-h-${index}`)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr className="border-b border-border-subtle text-foreground-soft" key={`${key}-r-${rowIndex}`}>
                  {row.map((cell, cellIndex) => <td className="px-3 py-3 align-top" key={`${key}-r-${rowIndex}-${cellIndex}`}>{renderCell(cell, `${key}-r-${rowIndex}-${cellIndex}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    case 'html': {
      const raw = String(token.text || token.raw || '')
      if (/^<br\s*\/?\s*>$/i.test(raw.trim())) return <br key={key} />
      return raw ? <span key={key}>{raw}</span> : null
    }
    default:
      return token.raw ? <span key={key}>{token.raw}</span> : children ? <span key={key}>{children}</span> : null
  }
}

function renderTokens(tokens: readonly MarkdownToken[], prefix: string) {
  return tokens.map((token, index) => renderToken(token, `${prefix}-${index}`))
}

type MarkdownContentProps = Readonly<{
  markdown: string
}>

export function MarkdownContent({ markdown }: MarkdownContentProps) {
  const normalized = cleanMarkdown(markdown)
  if (!normalized) return null

  const tokens = marked.lexer(normalized, { gfm: true }) as readonly MarkdownToken[]
  return <div className="min-w-0">{renderTokens(tokens, 'md')}</div>
}
