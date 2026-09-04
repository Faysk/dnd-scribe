import { NextResponse } from 'next/server'

import { safeRedirectPath } from '@/lib/auth/redirect'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeRedirectPath(url.searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', url.origin))
  }

  const supabase = await createServerSupabaseClient()
  if (!supabase) {
    return NextResponse.redirect(new URL('/login?error=callback', url.origin))
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(new URL('/login?error=callback', url.origin))
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
