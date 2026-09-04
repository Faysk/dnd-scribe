import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function readAuthenticatedAccessToken() {
  const supabase = await createServerSupabaseClient()
  if (!supabase) return ''

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) return ''

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) return ''
  return sessionData.session?.access_token || ''
}
