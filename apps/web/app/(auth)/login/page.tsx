import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { LoginButtons } from '@/components/auth/login-buttons'
import { Brand } from '@/components/shell/brand'
import { Surface } from '@/components/ui/surface'
import { BodyCopy, DisplayTitle, Eyebrow, MetaText } from '@/components/ui/typography'
import { readPublicSupabaseConfig } from '@/lib/config'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Entrar — DnD Scribe',
}

type LoginPageProps = Readonly<{
  searchParams: Promise<{ error?: string | string[] }>
}>

const callbackErrors: Record<string, string> = {
  callback: 'O retorno do provedor não pôde ser concluído. Tente entrar novamente.',
  missing_code: 'O provedor não devolveu um código de autenticação válido.',
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const config = readPublicSupabaseConfig()
  const supabase = config ? await createServerSupabaseClient() : null
  if (supabase) {
    const { data, error } = await supabase.auth.getClaims()
    if (!error && data?.claims) redirect('/')
  }

  const params = await searchParams
  const errorKey = Array.isArray(params.error) ? params.error[0] : params.error
  const callbackError = errorKey ? callbackErrors[errorKey] : ''

  return (
    <main id="content" tabIndex={-1} className="mx-auto grid min-h-screen w-[min(1180px,calc(100%-2.5rem))] place-items-center py-12">
      <Surface className="w-full max-w-2xl p-7 sm:p-10 lg:p-14" tone="elevated">
        <Brand />
        <div className="mt-10">
          <Eyebrow>Arquivo reservado</Eyebrow>
          <DisplayTitle className="mt-4">As histórias da mesa vivem aqui.</DisplayTitle>
          <BodyCopy className="mt-6 max-w-xl">
            Entre com sua conta da campanha para consultar as memórias publicadas da mesa.
          </BodyCopy>
          {callbackError ? <p className="mt-5 text-sm text-danger" role="alert">{callbackError}</p> : null}
          {!config ? (
            <MetaText className="mt-5 rounded-md border border-accent/30 bg-accent-muted p-3">
              Auth ainda não está configurado neste Preview. O shell técnico continua disponível para os gates anteriores.
            </MetaText>
          ) : null}
          <LoginButtons configured={Boolean(config)} />
        </div>
      </Surface>
    </main>
  )
}
