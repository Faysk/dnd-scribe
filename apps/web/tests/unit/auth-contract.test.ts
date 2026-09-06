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
    expect(payload.capabilities?.canReadTranscript).toBe(false)
    expect(payload.campaignRole).toBe('player')
    expect(hasCampaignRole(payload.campaignRole)).toBe(true)
    expect(hasCampaignRole('master')).toBe(true)
  })

  it('derives transcript visibility from the explicit RBAC permission', () => {
    const allowed = parseCampaignAccessPayload({
      campaignRole: 'player',
      rbac: {
        permissions: [
          { action: 'campaign.read' },
          { action: 'campaign.transcript.read', role_slug: 'transcript_viewer' },
        ],
      },
      capabilities: { canOpenEdit: false },
    })
    const denied = parseCampaignAccessPayload({
      campaignRole: 'player',
      rbac: { permissions: [{ action: 'campaign.read' }] },
      capabilities: { canOpenEdit: true, canReadTranscript: true },
    })

    expect(allowed.capabilities?.canReadTranscript).toBe(true)
    expect(denied.capabilities?.canReadTranscript).toBe(false)
  })

  it('accepts only membership roles that exist in the campaign contract', () => {
    expect(parseCampaignAccessPayload({ campaignRole: null }).campaignRole).toBeNull()
    expect(parseCampaignAccessPayload({ campaignRole: '' }).campaignRole).toBeNull()
    expect(() => parseCampaignAccessPayload({ campaignRole: {} })).toThrow('campaignRole')
    expect(() => parseCampaignAccessPayload({ campaignRole: ['player'] })).toThrow('campaignRole')
    expect(() => parseCampaignAccessPayload({ campaignRole: 'viewer' })).toThrow('campaignRole')
    expect(hasCampaignRole({ role: 'player' })).toBe(false)
    expect(hasCampaignRole('viewer')).toBe(false)
  })

  it('rejects oversized profile fields and invalid canOpenEdit types', () => {
    expect(() => parseCampaignAccessPayload({ profile: { displayName: 'x'.repeat(201) } })).toThrow(
      'profile.displayName',
    )
    expect(() => parseCampaignAccessPayload({ profile: { avatarUrl: `https://example.com/${'x'.repeat(2_100)}` } })).toThrow(
      'profile.avatarUrl',
    )
    expect(() => parseCampaignAccessPayload({ capabilities: { canOpenEdit: 'yes' } })).toThrow(
      'capabilities.canOpenEdit',
    )
  })
})
