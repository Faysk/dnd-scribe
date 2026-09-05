const rawBaseUrl = process.env.DND_RC_BASE_URL

if (!rawBaseUrl) {
  console.error('Defina DND_RC_BASE_URL com a origem HTTPS do release candidate.')
  process.exit(2)
}

let baseUrl
try {
  const parsed = new URL(rawBaseUrl)
  if (parsed.protocol !== 'https:') throw new Error('HTTPS obrigatório')
  if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('origem inválida')
  parsed.pathname = '/'
  baseUrl = parsed.origin
} catch (error) {
  console.error(`DND_RC_BASE_URL inválida: ${error instanceof Error ? error.message : 'valor inválido'}`)
  process.exit(2)
}

const checks = []
let failures = 0

async function check(pathname, validate) {
  const url = new URL(pathname, `${baseUrl}/`)
  const started = Date.now()

  try {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: {
        Accept: 'application/json,text/html;q=0.9,*/*;q=0.5',
        'User-Agent': 'dnd-scribe-rc-smoke/1',
      },
      signal: AbortSignal.timeout(15_000),
    })
    const result = await validate(response)
    const elapsedMs = Date.now() - started
    checks.push({ pathname, ok: result.ok, status: response.status, elapsedMs, note: result.note || '' })
    if (!result.ok) failures += 1
  } catch (error) {
    const elapsedMs = Date.now() - started
    checks.push({
      pathname,
      ok: false,
      status: null,
      elapsedMs,
      note: error instanceof Error ? error.message : 'falha inesperada',
    })
    failures += 1
  }
}

await check('/api/web/health', async (response) => {
  const payload = await response.json().catch(() => null)
  const ok = response.status === 200
    && payload?.ok === true
    && payload?.ready === true
    && payload?.surface === 'dnd-scribe-web-next'
    && payload?.runtime?.supabaseConfigured === true
    && payload?.runtime?.legacyOriginConfigured === true
    && String(response.headers.get('cache-control') || '').includes('no-store')
  return { ok, note: ok ? 'Web Next pronto e runtime configurado' : 'health indica runtime incompleto ou superfície errada' }
})

await check('/api/web/endpoint-que-nao-existe', async (response) => {
  const payload = await response.json().catch(() => null)
  const ok = response.status === 404 && payload?.ok === false
  return { ok, note: ok ? 'namespace /api/web reservado' : 'endpoint desconhecido escapou do namespace local' }
})

await check('/', async (response) => {
  const body = await response.text()
  const secureHeaders = response.headers.get('x-content-type-options') === 'nosniff'
    && response.headers.get('x-frame-options') === 'DENY'
  const ok = response.status === 200
    && secureHeaders
    && body.includes('Onde paramos?')
    && body.includes('Os resumos são públicos')
    && !body.includes('Modernização — Preview técnico')
  return { ok, note: ok ? 'Home pública disponível sem sessão' : 'Home pública ausente, insegura ou em modo técnico' }
})

await check('/sessoes', async (response) => {
  const body = await response.text()
  const ok = response.status === 200
    && body.includes('Arquivo cronológico')
    && body.includes('sessões públicas')
  return { ok, note: ok ? 'arquivo público disponível' : 'arquivo público não comprovado' }
})

const publicSessionId = 'rmDsxh640RR4'
await check(`/sessoes/${publicSessionId}`, async (response) => {
  const body = await response.text()
  const ok = response.status === 200
    && body.includes('O Olho que Devora a Floresta')
    && body.includes('Memória pública')
    && body.includes('Resumo público')
  return { ok, note: ok ? 'resumo completo acessível anonimamente' : 'memória pública real não comprovada' }
})

await check(`/sessoes/${publicSessionId}/transcricao`, async (response) => {
  const location = response.headers.get('location') || ''
  const target = new URL(location, `${baseUrl}/`)
  const ok = response.status >= 300
    && response.status < 400
    && target.pathname === '/login'
    && target.searchParams.get('next') === `/sessoes/${publicSessionId}/transcricao`
  return { ok, note: ok ? 'transcrição anônima exige login e preserva retorno' : 'boundary privado da transcrição falhou' }
})

await check('/login', async (response) => {
  const body = await response.text()
  const ok = response.status === 200
    && body.includes('Entrar com Discord')
    && body.includes('Entrar com Google')
    && body.includes('Os resumos da campanha são públicos')
    && !body.includes('Auth ainda não está configurado neste Preview')
  return { ok, note: ok ? 'login configurado e posicionado como acesso interno' : 'login ausente ou runtime ainda em modo técnico' }
})

if (process.env.DND_RC_EXPECT_GATEWAY === '1') {
  await check('/api/auth-config', async (response) => {
    const ok = response.status >= 200 && response.status < 500 && response.status !== 404
    return { ok, note: ok ? 'fallback /api alcançável' : 'fallback /api não comprovado' }
  })

  await check('/assets/sessions/2026-07-25/card.webp', async (response) => {
    const contentType = response.headers.get('content-type') || ''
    const ok = response.status === 200 && contentType.startsWith('image/')
    return { ok, note: ok ? 'arte histórica preservada pelo gateway estreito' : 'fallback de arte histórica falhou' }
  })

  for (const pathname of ['/terms', '/privacy', '/docs/api']) {
    await check(pathname, async (response) => {
      const ok = response.status >= 200 && response.status < 400
      return { ok, note: ok ? 'fallback legado alcançável' : 'fallback legado falhou' }
    })
  }
}

console.table(checks)

if (failures) {
  console.error(`RC smoke falhou em ${failures} check(s).`)
  process.exit(1)
}

console.log(`RC smoke aprovado em ${checks.length} check(s) para ${baseUrl}.`)
