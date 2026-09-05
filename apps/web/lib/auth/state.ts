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

const ID_MAX_LENGTH = 220
const EMAIL_MAX_LENGTH = 320
const DISPLAY_NAME_MAX_LENGTH = 200
const AVATAR_URL_MAX_LENGTH = 2_048

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null
}

function text(record: JsonRecord | null, key: string, maxLength = DISPLAY_NAME_MAX_LENGTH) {
  const value = record?.[key]
  if (typeof value !== 'string') return ''
  const normalized = value.trim()
  return normalized.length <= maxLength ? normalized : ''
}

function safeHttpsUrl(value: string) {
  if (!value || value.length > AVATAR_URL_MAX_LENGTH) return ''
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return ''
    return parsed.toString()
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

  const email = text(apiUser, 'email', EMAIL_MAX_LENGTH) || text(claims, 'email', EMAIL_MAX_LENGTH)
  const displayName =
    text(profile, 'displayName') ||
    text(apiUser, 'displayName') ||
    text(metadata, 'full_name') ||
    text(metadata, 'global_name') ||
    text(metadata, 'name') ||
    email ||
    'Membro da mesa'
  const avatarUrl = safeHttpsUrl(
    text(profile, 'avatarUrl', AVATAR_URL_MAX_LENGTH) ||
      text(apiUser, 'avatarUrl', AVATAR_URL_MAX_LENGTH) ||
      text(metadata, 'avatar_url', AVATAR_URL_MAX_LENGTH) ||
      text(metadata, 'picture', AVATAR_URL_MAX_LENGTH),
  )

  return {
    id: text(apiUser, 'id', ID_MAX_LENGTH) || text(claims, 'sub', ID_MAX_LENGTH),
    email,
    displayName,
    avatarUrl,
  }
}

export function campaignRoleLabel(role: unknown) {
  if (role === 'master') return 'Mestre'
  if (role === 'player') return 'Jogador'
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
