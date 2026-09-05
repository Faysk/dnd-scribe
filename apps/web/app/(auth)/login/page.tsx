import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { LoginButtons } from '@/components/auth/login-buttons'
import { Brand } from '@/components/shell/brand'
import { Surface } from '@/components/ui/surface'
import { BodyCopy, DisplayTitle, Eyebrow, MetaText } from '@/components/ui/typography'
import { safeRedirectPath } from '@/lib/auth/redirect'
import { canRenderUnconfiguredPreview, readPublicSupabaseConfig } from '@/lib/config'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Entrar — DnD Scribe',
}

type LoginPageProps = Readonly<{
  searchParams: Promise<{
    error?: string | string[]
    next?: string | string[]
  }>
}>

const callbackErrors: Record<string, string> = {
  callback: 'O retorno do provedor não pôde ser concluído. Tente entrar novamente.',
  missing_code: 'O provedor não devolveu um código de autenticação válido.',
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next
  const nextPath = safeRedirectPath(rawNext)

  const config = readPublicSupabaseConfig()
  const supabase = config ? await createServerSupabaseClient() : null
  if (supabase) {
    const { data, error } = await supabase.auth.getClaims()
    if (!error && data?.claims) redirect(nextPath)
  }

  const errorKey = Array.isArray(params.error) ? params.error[0] : params.error
  const callbackError = errorKey ? callbackErrors[errorKey] : ''

  return (
    <main id="content" tabIndex={-1} className="mx-auto grid min-h-screen w-[min(1180px,calc(100%-2.5rem))] place-items-center py-12">
      <Surface className="w-full max-w-2xl p-7 sm:p-10 lg:p-14" tone="elevated">
        <Brand />
        <div className="mt-10">
          <Eyebrow>Área da mesa</Eyebrow>
          <DisplayTitle className="mt-4">Entre para acessar o material interno.</DisplayTitle>
          <BodyCopy className="mt-6 max-w-xl">
            Os resumos da campanha são públicos. O login libera transcrições, downloads e ferramentas reservadas aos membros aprovados da mesa.
          </BodyCopy>
          {callbackError ? <p className="mt-5 text-sm text-danger" role="alert">{callbackError}</p> : null}
          {!config ? (
            <MetaText className="mt-5 rounded-md border border-accent/30 bg-accent-muted p-3">
              {canRenderUnconfiguredPreview()
                ? 'Auth ainda não está configurado neste Preview. As memórias públicas continuam independentes desse gate.'
                : 'O login está temporariamente indisponível. Os resumos públicos continuam acessíveis.'}
            </MetaText>
          ) : null}
          <LoginButtons configured={Boolean(config)} nextPath={nextPath} />
        </div>
      </Surface>
    </main>
  )
}
