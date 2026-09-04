export type JsonRecord = Record<string, unknown>

export type CampaignProfile = JsonRecord & {
  displayName?: string
  avatarUrl?: string
}

export type CampaignCapabilities = JsonRecord & {
  canOpenEdit?: boolean
}

export type CampaignAccessPayload = Readonly<{
  user: JsonRecord | null
  profile: CampaignProfile | null
  campaignRole: string | null
  capabilities: CampaignCapabilities | null
}>

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function optionalRecord(value: unknown, field: string) {
  if (value == null) return null
  if (!isRecord(value)) throw new Error(`Payload de auth inválido: ${field}.`)
  return value
}

function parseCampaignRole(value: unknown) {
  if (value == null || value === '') return null
  if (typeof value !== 'string') throw new Error('Payload de auth inválido: campaignRole.')
  const role = value.trim()
  if (!role || role.length > 80) throw new Error('Payload de auth inválido: campaignRole.')
  return role
}

export function parseCampaignAccessPayload(value: unknown): CampaignAccessPayload {
  if (!isRecord(value)) throw new Error('Payload de auth inválido.')

  const user = optionalRecord(value.user, 'user')
  const profile = optionalRecord(value.profile, 'profile') as CampaignProfile | null
  const capabilities = optionalRecord(value.capabilities, 'capabilities') as CampaignCapabilities | null

  if (profile?.displayName != null && typeof profile.displayName !== 'string') {
    throw new Error('Payload de auth inválido: profile.displayName.')
  }
  if (profile?.avatarUrl != null && typeof profile.avatarUrl !== 'string') {
    throw new Error('Payload de auth inválido: profile.avatarUrl.')
  }
  if (capabilities?.canOpenEdit != null && typeof capabilities.canOpenEdit !== 'boolean') {
    throw new Error('Payload de auth inválido: capabilities.canOpenEdit.')
  }

  return {
    user,
    profile,
    campaignRole: parseCampaignRole(value.campaignRole),
    capabilities,
  }
}

export function hasCampaignRole(role: unknown): role is string {
  return typeof role === 'string' && role.trim().length > 0 && role.length <= 80
}
