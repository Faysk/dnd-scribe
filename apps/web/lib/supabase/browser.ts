'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

import { readPublicSupabaseConfig } from '@/lib/config'

let browserClient: SupabaseClient | null = null

export function createBrowserSupabaseClient() {
  const config = readPublicSupabaseConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  )
  if (!config) return null
  if (!browserClient) {
    browserClient = createBrowserClient(config.url, config.publishableKey)
  }
  return browserClient
}
