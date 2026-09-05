import { describe, expect, it } from 'vitest'

import { buildAuthIdentity, campaignRoleLabel } from '../../lib/auth/state'

describe('auth identity normalization', () => {
  it('bounds user-controlled identity fields and rejects credentialed avatar URLs', () => {
    const identity = buildAuthIdentity({
      sub: 'u1',
      email: 'player@example.com',
      user_metadata: {
        full_name: 'x'.repeat(201),
        avatar_url: 'https://user:pass@example.com/avatar.png',
      },
    })

    expect(identity.id).toBe('u1')
    expect(identity.displayName).toBe('player@example.com')
    expect(identity.avatarUrl).toBe('')
  })

  it('uses localized labels for the campaign roles', () => {
    expect(campaignRoleLabel('master')).toBe('Mestre')
    expect(campaignRoleLabel('player')).toBe('Jogador')
    expect(campaignRoleLabel('viewer')).toBe('Membro da campanha')
  })
})
