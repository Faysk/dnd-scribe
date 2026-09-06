import { CAMPAIGN_SLUG, DEFAULT_LEGACY_ORIGIN, readPublicSupabaseConfig } from '@/lib/config'
import { parseLegacyGatewayOrigin } from '@/lib/gateway'

export type HealthPayload = {
  ok: true
  ready: boolean
  surface: 'tda-web'
  app: 'dnd-scribe-vercel'
  campaignSlug: string
  deployment: {
    commitSha: string | null
    commitRef: string | null
    environment: string | null
  }
  runtime: {
    supabaseConfigured: boolean
    legacyOriginConfigured: boolean
  }
}

export type HealthEnvironment = Pick<
  NodeJS.ProcessEnv,
  | 'DND_LEGACY_ORIGIN'
  | 'VERCEL_GIT_COMMIT_SHA'
  | 'VERCEL_GIT_COMMIT_REF'
  | 'VERCEL_ENV'
  | 'NODE_ENV'
>

export function buildHealthPayload(env: HealthEnvironment = process.env): HealthPayload {
  const supabaseConfigured = Boolean(readPublicSupabaseConfig())
  const legacyOriginConfigured = Boolean(
    parseLegacyGatewayOrigin(env.DND_LEGACY_ORIGIN || DEFAULT_LEGACY_ORIGIN),
  )

  return {
    ok: true,
    ready: supabaseConfigured && legacyOriginConfigured,
    surface: 'tda-web',
    // Compatibilidade com o antigo GET /api/health durante a Fase 2.
    // Esses campos podem ser removidos somente depois do cutover estrutural da #48.
    app: 'dnd-scribe-vercel',
    campaignSlug: CAMPAIGN_SLUG,
    deployment: {
      commitSha: env.VERCEL_GIT_COMMIT_SHA || null,
      commitRef: env.VERCEL_GIT_COMMIT_REF || null,
      environment: env.VERCEL_ENV || env.NODE_ENV || null,
    },
    runtime: {
      supabaseConfigured,
      legacyOriginConfigured,
    },
  }
}
