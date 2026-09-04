import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { readPublicSupabaseConfig } from '@/lib/config'

export async function createServerSupabaseClient() {
  const config = readPublicSupabaseConfig()
  if (!config) return null

  const cookieStore = await cookies()
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot write cookies. proxy.ts handles refresh propagation.
        }
      },
    },
  })
}
