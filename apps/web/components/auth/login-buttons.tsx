'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/action'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser'

type Provider = 'discord' | 'google'

type LoginButtonsProps = Readonly<{
  configured: boolean
  nextPath?: string
}>

export function LoginButtons({ configured, nextPath = '/' }: LoginButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null)
  const [error, setError] = useState('')

  async function signIn(provider: Provider) {
    setError('')
    setLoadingProvider(provider)

    const supabase = createBrowserSupabaseClient()
    if (!supabase) {
      setError('O login está temporariamente indisponível.')
      setLoadingProvider(null)
      return
    }

    const callback = new URL('/auth/callback', window.location.origin)
    callback.searchParams.set('next', nextPath)
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callback.toString() },
    })

    if (authError) {
      console.error('[web-next] Falha ao iniciar OAuth.', authError)
      setError('Não foi possível iniciar o login. Tente novamente em instantes.')
      setLoadingProvider(null)
    }
  }

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          disabled={!configured || Boolean(loadingProvider)}
          onClick={() => void signIn('discord')}
          variant="primary"
        >
          {loadingProvider === 'discord' ? 'Abrindo Discord…' : 'Entrar com Discord'}
        </Button>
        <Button
          disabled={!configured || Boolean(loadingProvider)}
          onClick={() => void signIn('google')}
          variant="secondary"
        >
          {loadingProvider === 'google' ? 'Abrindo Google…' : 'Entrar com Google'}
        </Button>
      </div>
      {error ? <p className="mt-4 text-sm text-danger" role="alert">{error}</p> : null}
    </div>
  )
}
