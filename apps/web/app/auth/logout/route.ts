import { NextResponse } from 'next/server'

import { isSameOriginMutation } from '@/lib/security'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return new Response('Origem da solicitação não autorizada.', { status: 403 })
  }

  const supabase = await createServerSupabaseClient()
  if (supabase) await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', request.url), 303)
}
