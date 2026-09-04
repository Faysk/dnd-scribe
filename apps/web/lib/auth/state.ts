import { fetchCampaignAccess, LegacyAuthError } from '@/lib/api/auth'
import {
  hasCampaignRole,
  type CampaignAccessPayload,
  type JsonRecord,
} from '@/lib/api/contracts/auth'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export type AuthIdentity = Readonly<{
  id: string
  email: string
  displayName: string
  avatarUrl: string
}>

export type AuthState =
  | Readonly<{ kind: 'anonymous' }>
  | Readonly<{ kind: 'pendingAccess'; identity: AuthIdentity }>
  | Readonly<{
      kind: 'authorized'
      identity: AuthIdentity
      access: CampaignAccessPayload
    }>

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null
}

function text(record: JsonRecord | null, key: string) {
  const value = record?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

function safeHttpsUrl(value: string) {
  if (!value) return ''
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' ? parsed.toString() : ''
  } catch {
    return ''
  }
}

export function buildAuthIdentity(
  claimsValue: unknown,
  access?: CampaignAccessPayload | null,
): AuthIdentity {
  const claims = asRecord(claimsValue)
  const metadata = asRecord(claims?.user_metadata)
  const apiUser = access?.user ?? null
  const profile = access?.profile ?? null

  const email = text(apiUser, 'email') || text(claims, 'email')
  const displayName =
    text(profile, 'displayName') ||
    text(apiUser, 'displayName') ||
    text(metadata, 'full_name') ||
    text(metadata, 'global_name') ||
    text(metadata, 'name') ||
    email ||
    'Membro da mesa'
  const avatarUrl = safeHttpsUrl(
    text(profile, 'avatarUrl') ||
      text(apiUser, 'avatarUrl') ||
      text(metadata, 'avatar_url') ||
      text(metadata, 'picture'),
  )

  return {
    id: text(apiUser, 'id') || text(claims, 'sub'),
    email,
    displayName,
    avatarUrl,
  }
}

export function campaignRoleLabel(role: unknown) {
  if (typeof role === 'string' && role.trim()) return role.trim()
  const record = asRecord(role)
  return text(record, 'label') || text(record, 'name') || text(record, 'role') || 'Membro da campanha'
}

export async function resolveAuthState(): Promise<AuthState> {
  const supabase = await createServerSupabaseClient()
  if (!supabase) return { kind: 'anonymous' }

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  if (claimsError || !claimsData?.claims) return { kind: 'anonymous' }

  const claims = claimsData.claims
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token || ''
  if (sessionError || !accessToken) return { kind: 'anonymous' }

  try {
    const access = await fetchCampaignAccess(accessToken)
    const identity = buildAuthIdentity(claims, access)
    if (!hasCampaignRole(access.campaignRole)) {
      return { kind: 'pendingAccess', identity }
    }
    return { kind: 'authorized', identity, access }
  } catch (error) {
    if (error instanceof LegacyAuthError && error.status === 401) return { kind: 'anonymous' }
    if (error instanceof LegacyAuthError && error.status === 403) {
      return { kind: 'pendingAccess', identity: buildAuthIdentity(claims) }
    }
    throw error
  }
}
