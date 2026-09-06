export type JsonRecord = Record<string, unknown>

export const CAMPAIGN_ROLES = ['master', 'player'] as const
export type CampaignRole = (typeof CAMPAIGN_ROLES)[number]

export type CampaignProfile = JsonRecord & {
  displayName?: string
  avatarUrl?: string
}

export type CampaignCapabilities = JsonRecord & {
  canOpenEdit?: boolean
  canReadTranscript?: boolean
}

export type CampaignAccessPayload = Readonly<{
  user: JsonRecord | null
  profile: CampaignProfile | null
  campaignRole: CampaignRole | null
  capabilities: CampaignCapabilities | null
}>

const campaignRoles = new Set<string>(CAMPAIGN_ROLES)

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function optionalRecord(value: unknown, field: string) {
  if (value == null) return null
  if (!isRecord(value)) throw new Error(`Payload de auth inválido: ${field}.`)
  return value
}

function validateOptionalString(value: unknown, maxLength: number, field: string) {
  if (value == null) return
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw new Error(`Payload de auth inválido: ${field}.`)
  }
}

function parseCampaignRole(value: unknown): CampaignRole | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string') throw new Error('Payload de auth inválido: campaignRole.')
  const role = value.trim()
  if (!campaignRoles.has(role)) throw new Error('Payload de auth inválido: campaignRole.')
  return role as CampaignRole
}

function hasRbacPermission(value: JsonRecord, action: string) {
  const rbac = value.rbac
  if (!isRecord(rbac) || !Array.isArray(rbac.permissions)) return false
  return rbac.permissions.some((permission) => {
    if (!isRecord(permission)) return false
    return permission.action === action || permission.permission_action === action
  })
}

export function parseCampaignAccessPayload(value: unknown): CampaignAccessPayload {
  if (!isRecord(value)) throw new Error('Payload de auth inválido.')

  const user = optionalRecord(value.user, 'user')
  const profile = optionalRecord(value.profile, 'profile') as CampaignProfile | null
  const rawCapabilities = optionalRecord(value.capabilities, 'capabilities') as CampaignCapabilities | null

  validateOptionalString(profile?.displayName, 200, 'profile.displayName')
  validateOptionalString(profile?.avatarUrl, 2_048, 'profile.avatarUrl')
  if (rawCapabilities?.canOpenEdit != null && typeof rawCapabilities.canOpenEdit !== 'boolean') {
    throw new Error('Payload de auth inválido: capabilities.canOpenEdit.')
  }

  const capabilities: CampaignCapabilities = {
    ...(rawCapabilities || {}),
    canReadTranscript: hasRbacPermission(value, 'campaign.transcript.read'),
  }

  return {
    user,
    profile,
    campaignRole: parseCampaignRole(value.campaignRole),
    capabilities,
  }
}

export function hasCampaignRole(role: unknown): role is CampaignRole {
  return typeof role === 'string' && campaignRoles.has(role)
}
