import { describe, expect, it } from 'vitest'

import { hasCampaignRole, parseCampaignAccessPayload } from '../../lib/api/contracts/auth'

describe('campaign access contract', () => {
  it('accepts the legacy fields consumed by the public app', () => {
    const payload = parseCampaignAccessPayload({
      user: { id: 'u1', email: 'player@example.com' },
      profile: { displayName: 'Dandelion', avatarUrl: 'https://example.com/avatar.png' },
      campaignRole: 'player',
      capabilities: { canOpenEdit: true, otherCapability: false },
    })

    expect(payload.profile?.displayName).toBe('Dandelion')
    expect(payload.capabilities?.canOpenEdit).toBe(true)
    expect(payload.campaignRole).toBe('player')
    expect(hasCampaignRole(payload.campaignRole)).toBe(true)
  })

  it('normalizes absent roles and rejects malformed role shapes', () => {
    expect(parseCampaignAccessPayload({ campaignRole: null }).campaignRole).toBeNull()
    expect(parseCampaignAccessPayload({ campaignRole: '' }).campaignRole).toBeNull()
    expect(() => parseCampaignAccessPayload({ campaignRole: {} })).toThrow('campaignRole')
    expect(() => parseCampaignAccessPayload({ campaignRole: ['player'] })).toThrow('campaignRole')
    expect(hasCampaignRole({ role: 'player' })).toBe(false)
  })

  it('rejects invalid canOpenEdit types', () => {
    expect(() => parseCampaignAccessPayload({ capabilities: { canOpenEdit: 'yes' } })).toThrow(
      'capabilities.canOpenEdit',
    )
  })
})
