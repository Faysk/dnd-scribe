import { NextResponse } from 'next/server'

import { safeRedirectPath } from '@/lib/auth/redirect'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const OAUTH_CODE_MAX_LENGTH = 4_096

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeRedirectPath(url.searchParams.get('next'))

  if (!code || code.length > OAUTH_CODE_MAX_LENGTH) {
    return NextResponse.redirect(new URL('/login?error=missing_code', url.origin))
  }

  const supabase = await createServerSupabaseClient()
  if (!supabase) {
    return NextResponse.redirect(new URL('/login?error=callback', url.origin))
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.warn('[web-next] Falha ao trocar código OAuth por sessão.', { category: 'oauth_callback' })
    return NextResponse.redirect(new URL('/login?error=callback', url.origin))
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
