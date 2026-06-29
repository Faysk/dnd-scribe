(function () {
  const CAMPAIGN_SLUG = 'yuhara-main';
  const PROJECT_SCOPE_ID = 'dnd-scribe';
  const accessState = {
    loading: false,
    loaded: false,
    error: null,
    directory: null,
    rbac: {
      loading: false,
      loaded: false,
      error: null,
      data: null,
      busy: false
    }
  };

  function esc(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function q(selector) {
    return document.querySelector(selector);
  }

  function chip(text, tone = '') {
    return `<span class="badge ${tone}">${esc(text)}</span>`;
  }

  function roleLabel(role) {
    return {
      owner: 'Owner tecnico',
      master: 'DM',
      player: 'Jogador',
      reviewer: 'Revisor',
      viewer: 'Leitor'
    }[role] || 'Sem papel';
  }

  function rbacRoleLabel(roleSlug) {
    return {
      platform_owner: 'Owner tecnico',
      platform_operator: 'Operador tecnico',
      security_admin: 'Admin seguranca',
      billing_observer: 'Custos',
      campaign_owner: 'Owner da campanha',
      campaign_dm: 'DM',
      campaign_reviewer: 'Revisor',
      player: 'Jogador',
      viewer: 'Leitor',
      former_dm_archive_reader: 'Ex-DM arquivo'
    }[roleSlug] || roleSlug || 'Funcao';
  }

  function planeLabel(plane) {
    return { technical: 'Tecnico', narrative: 'Narrativo', mixed: 'Misto' }[plane] || plane || 'Plano';
  }

  function roleTone(roleSlug, plane = '') {
    if (roleSlug === 'campaign_dm') return 'gold';
    if (plane === 'technical') return 'blue';
    if (plane === 'mixed') return 'violet';
    return 'green';
  }

  function ensureAccessTab() {
    const tabs = q('#tabs');
    if (!tabs) return;
    if (!tabs.querySelector('[data-tab="access"]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.tab = 'access';
      button.textContent = 'Acesso';
      tabs.appendChild(button);
    }
    window.syncTabsA11y?.();
  }

  function supabaseClient() {
    return window.state?.auth?.client || null;
  }

  function authUser() {
    return window.state?.auth?.user || null;
  }

  function loginName() {
    const user = authUser();
    return user?.user_metadata?.full_name
      || user?.user_metadata?.name
      || user?.user_metadata?.global_name
      || user?.user_metadata?.preferred_username
      || user?.user_metadata?.user_name
      || user?.user_metadata?.username
      || user?.email
      || '';
  }

  function discordIdentity() {
    const user = authUser();
    const identity = (user?.identities || []).find(item => item.provider === 'discord');
    const data = identity?.identity_data || {};
    const metadata = user?.user_metadata || {};
    return {
      id: data.provider_id || data.sub || metadata.provider_id || metadata.sub || '',
      handle: data.user_name || data.preferred_username || data.username || metadata.user_name || metadata.preferred_username || metadata.username || ''
    };
  }

  function loginProviderLabel() {
    const user = authUser();
    const provider = user?.app_metadata?.provider || user?.identities?.[0]?.provider || 'oauth';
    return { discord: 'Discord', google: 'Google' }[provider] || 'OAuth';
  }

  async function loadAccessDirectory(force = false) {
    if (accessState.loading) return;
    if (accessState.loaded && !force) return;
    const client = supabaseClient();
    if (!client || !authUser()) {
      accessState.loaded = true;
      accessState.directory = null;
      accessState.error = null;
      return;
    }
    accessState.loading = true;
    accessState.error = null;
    renderAccessPanel();
    try {
      const { data, error } = await client.rpc('access_directory', { campaign_slug: CAMPAIGN_SLUG });
      if (error) throw error;
      accessState.directory = data;
      accessState.loaded = true;
    } catch (error) {
      accessState.error = error.message || String(error);
    } finally {
      accessState.loading = false;
      renderAccessPanel();
    }
  }

  async function loadRbacAdmin(force = false) {
    const rbac = accessState.rbac;
    if (rbac.loading) return;
    if (rbac.loaded && !force) return;
    if (!authUser()) {
      rbac.loaded = true;
      rbac.data = null;
      rbac.error = null;
      return;
    }
    rbac.loading = true;
    rbac.error = null;
    renderAccessPanel();
    try {
      const payload = await window.api(`/api/rbac?campaignSlug=${encodeURIComponent(CAMPAIGN_SLUG)}`);
      rbac.data = payload.rbac || payload;
      rbac.loaded = true;
    } catch (error) {
      rbac.error = error.message || String(error);
    } finally {
      rbac.loading = false;
      renderAccessPanel();
    }
  }

  function authCapabilities() {
    return window.state?.auth?.capabilities || {};
  }

  function canManageRoleAdmin(viewer = {}) {
    const capabilities = authCapabilities();
    return Boolean(
      viewer.canManageAccess
      || capabilities.canManageAccess
      || capabilities.canManageTechnical
      || window.canManageAccess?.()
    );
  }

  function canManageTechnicalRoles() {
    const capabilities = authCapabilities();
    return Boolean(
      capabilities.canManageTechnical
      || accessState.rbac.data?.viewer?.canManageTechnical
    );
  }

  function profileCharacters(profileId) {
    return (accessState.directory?.characters || []).filter(item => item.profileId === profileId);
  }

  function profileOptions() {
    const profiles = accessState.directory?.profiles || [];
    return [
      '<option value="">Novo jogador / convidado</option>',
      ...profiles.map(profile => {
        const linked = profile.linked ? ' vinculado' : ' livre';
        return `<option value="${esc(profile.id)}">${esc(profile.displayName || 'Perfil')} - ${esc(profile.roll20Name || 'sem Roll20')} (${esc(roleLabel(profile.role))},${linked})</option>`;
      })
    ].join('');
  }

  function pendingClaims() {
    return (accessState.directory?.claims || []).filter(item => item.status === 'pending');
  }

  function renderAccessPanel() {
    if (window.state?.tab !== 'access') return;
    window.syncTabsA11y?.();
    const view = q('#view');
    if (!view) return;
    view.innerHTML = renderAccess();
  }

  function renderAccess() {
    const user = authUser();
    if (!window.state?.auth?.ready) {
      return accessShell('Conectando login...', '<div class="loader-line"></div>');
    }
    if (!user) {
      return accessShell('Entrar na mesa', `
        <div class="access-empty">
          <p>Entre com Discord para vincular seu perfil da mesa e personagens. Google fica como alternativa.</p>
          <div class="auth-actions"><button class="primary" onclick="signInDiscord()">Entrar Discord</button><button onclick="signInGoogle()">Google</button></div>
        </div>
      `);
    }
    if (accessState.loading && !accessState.directory) {
      return accessShell('Carregando acesso...', '<div class="loader-line"></div>');
    }
    if (accessState.error) {
      return accessShell('Acesso', `
        <div class="access-empty">
          <p>${esc(accessState.error)}</p>
          <button onclick="loadAccessDirectory(true)">Tentar de novo</button>
        </div>
      `);
    }
    const directory = accessState.directory;
    if (!directory) {
      window.setTimeout(() => loadAccessDirectory(true), 0);
      return accessShell('Acesso', '<div class="loader-line"></div>');
    }
    const viewer = directory.viewer || {};
    const canManage = canManageRoleAdmin(viewer);
    if (canManage && !accessState.rbac.loaded && !accessState.rbac.loading) {
      window.setTimeout(() => loadRbacAdmin(false), 0);
    }
    return accessShell('Acesso da mesa', `
      <section class="access-grid">
        <article class="panel access-card wide">
          <div class="panel-head">
            <h2>Seu login</h2>
            <div class="badges">
              ${chip(loginProviderLabel(), loginProviderLabel() === 'Discord' ? 'violet' : 'green')}
              ${chip(roleLabel(viewer.campaignRole), canManage ? 'gold' : viewer.campaignRole ? 'blue' : 'orange')}
            </div>
          </div>
          <div class="panel-body access-profile-summary">
            <strong>${esc(viewer.displayName || loginName() || user.email)}</strong>
            <small>${viewer.profileId ? 'Perfil da mesa vinculado.' : 'Login conectado; perfil da mesa ainda pendente.'}</small>
            <div class="actions">
              <button onclick="loadAccessDirectory(true)">Atualizar</button>
              <button onclick="signOutAuth()">Sair</button>
            </div>
          </div>
        </article>
        <article class="panel access-card">
          <div class="panel-head"><h2>Solicitar vinculo</h2>${chip('DM aprova', 'gold')}</div>
          <div class="panel-body">${claimForm()}</div>
        </article>
        <article class="panel access-card">
          <div class="panel-head"><h2>Solicitacoes</h2>${chip(`${pendingClaims().length} pendentes`, pendingClaims().length ? 'orange' : 'green')}</div>
          <div class="panel-body">${claimsList(canManage)}</div>
        </article>
        <article class="panel access-card wide">
          <div class="panel-head"><h2>Jogadores e personagens</h2>${chip(`${(directory.profiles || []).length} perfis`, 'blue')}</div>
          <div class="panel-body access-directory">${profilesList()}</div>
        </article>
        ${canManage ? rbacAdminPanel() : ''}
      </section>
    `);
  }

  function accessShell(title, body) {
    return `
      <section class="access-page">
        <div class="row between access-title">
          <div>
            <span class="label">Hierarquia</span>
            <h2>${esc(title)}</h2>
          </div>
          <div class="badges">
            ${chip('Owner tecnico', 'blue')}
            ${chip('DM canon final', 'gold')}
            ${chip('Player solicita', 'green')}
          </div>
        </div>
        ${body}
      </section>
    `;
  }

  function claimForm() {
    const user = authUser();
    const existing = (accessState.directory?.claims || []).find(item => item.status === 'pending');
    const discord = discordIdentity();
    return `
      <div class="detail-grid access-form">
        ${existing ? `<div class="empty">Voce ja tem uma solicitacao pendente. Enviar de novo atualiza a mesma solicitacao.</div>` : ''}
        <label><span class="label">Perfil alvo</span><select id="accessTargetProfile">${profileOptions()}</select></label>
        <div class="field-grid">
          <label><span class="label">Nome na vida</span><input id="accessDisplayName" value="${esc(loginName())}" placeholder="Nome preferido" /></label>
          <label><span class="label">Nick Roll20/Craig</span><input id="accessRoll20Name" placeholder="ex: faysk" /></label>
          <label><span class="label">Discord ID</span><input id="accessDiscordId" value="${esc(discord.id)}" placeholder="ID numerico" /></label>
          <label><span class="label">Discord handle</span><input id="accessDiscordHandle" value="${esc(discord.handle)}" placeholder="ex: faysk" /></label>
        </div>
        <label><span class="label">Personagens</span><input id="accessCharacters" placeholder="Dandelion, outro personagem futuro" /></label>
        <label><span class="label">Nota para o DM</span><textarea id="accessPlayerNote" placeholder="Explique quem voce e, quais personagens interpreta e qualquer detalhe de Discord/Craig."></textarea></label>
        <div class="actions"><button class="primary" onclick="submitAccessClaim()" ${user ? '' : 'disabled'}>Enviar para aprovacao</button></div>
      </div>
    `;
  }

  function claimsList(canManage) {
    const claims = accessState.directory?.claims || [];
    if (!claims.length) return '<div class="empty">Nenhuma solicitacao registrada.</div>';
    return `
      <div class="access-claims">
        ${claims.map(claim => claimCard(claim, canManage)).join('')}
      </div>
    `;
  }

  function claimCard(claim, canManage) {
    const target = (accessState.directory?.profiles || []).find(profile => profile.id === claim.targetProfileId);
    const chars = (claim.requestedCharacterNames || []).filter(Boolean).join(', ') || '-';
    return `
      <div class="job-row access-claim ${claim.status}">
        <div class="row between">
          <strong>${esc(claim.requestedDisplayName || claim.requesterName || claim.requesterEmail || 'Solicitante')}</strong>
          <div class="badges">${chip(claim.status, claim.status === 'approved' ? 'green' : claim.status === 'rejected' ? 'red' : 'orange')}</div>
        </div>
        <small>Alvo: ${esc(target?.displayName || 'Novo perfil')} | Roll20: ${esc(claim.requestedRoll20Name || '-')} | Discord: ${esc(claim.requestedDiscordHandle || claim.requestedDiscordId || '-')}</small>
        <p>Personagens: ${esc(chars)}</p>
        ${claim.playerNote ? `<p>${esc(claim.playerNote)}</p>` : ''}
        ${claim.reviewNote ? `<small>Nota DM: ${esc(claim.reviewNote)}</small>` : ''}
        ${canManage && claim.status === 'pending' ? `
          <label><span class="label">Nota da revisao</span><input id="reviewNote_${esc(claim.id)}" placeholder="Opcional" /></label>
          <div class="actions">
            <button class="success" onclick="reviewAccessClaim('${esc(claim.id)}', 'approved')">Aprovar vinculo</button>
            <button class="danger" onclick="reviewAccessClaim('${esc(claim.id)}', 'rejected')">Rejeitar</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  function profilesList() {
    const profiles = accessState.directory?.profiles || [];
    if (!profiles.length) return '<div class="empty">Nenhum perfil encontrado.</div>';
    return profiles.map(profile => {
      const characters = profileCharacters(profile.id);
      return `
        <div class="job-row access-player">
          <div class="row between">
            <div>
              <strong>${esc(profile.displayName || 'Perfil')}</strong>
              <small>${esc(profile.roll20Name || 'sem Roll20')} | ${esc(profile.discordHandle || profile.discordId || 'sem Discord')}</small>
            </div>
            <div class="badges">
              ${chip(roleLabel(profile.role), profile.role === 'master' ? 'gold' : profile.role ? 'blue' : 'orange')}
              ${chip(profile.linked ? 'login vinculado' : 'login pendente', profile.linked ? 'green' : 'orange')}
            </div>
          </div>
          <div class="badges">
            ${characters.map(item => chip(item.characterName, item.status === 'active' ? 'green' : 'blue')).join('') || chip(profile.defaultCharacterName || 'sem personagem', 'orange')}
          </div>
        </div>
      `;
    }).join('');
  }

  function rbacProfiles() {
    return accessState.rbac.data?.profiles || accessState.directory?.profiles || [];
  }

  function rbacProfileName(profileId) {
    const profile = rbacProfiles().find(item => item.id === profileId);
    return profile?.displayName || profile?.roll20Name || 'Perfil';
  }

  function rbacProfileOptions(selected = '') {
    const profiles = rbacProfiles();
    if (!profiles.length) return '<option value="">Nenhum perfil encontrado</option>';
    return [
      '<option value="">Selecione um perfil</option>',
      ...profiles.map(profile => {
        const name = profile.displayName || profile.roll20Name || 'Perfil';
        const detail = profile.roll20Name || profile.discordHandle || profile.email || 'sem nick';
        const legacy = profile.legacyCampaignRole || profile.role || 'sem papel';
        return `<option value="${esc(profile.id)}" ${profile.id === selected ? 'selected' : ''}>${esc(name)} - ${esc(detail)} (${esc(roleLabel(legacy))})</option>`;
      })
    ].join('');
  }

  function rbacRoleOptions() {
    const roles = (accessState.rbac.data?.roles || [])
      .filter(role => role.slug !== 'campaign_dm')
      .filter(role => canManageTechnicalRoles() || role.plane !== 'technical');
    if (!roles.length) return '<option value="">Nenhuma funcao disponivel</option>';
    return [
      '<option value="">Selecione uma funcao</option>',
      ...roles.map(role => `
        <option value="${esc(role.slug)}" data-plane="${esc(role.plane)}">
          ${esc(rbacRoleLabel(role.slug))} - ${esc(planeLabel(role.plane))}
        </option>
      `)
    ].join('');
  }

  function rbacActiveDm() {
    return (accessState.rbac.data?.dmTenures || [])
      .find(item => item.status === 'active' && item.tenureType === 'primary');
  }

  function rbacAdminPanel() {
    const rbac = accessState.rbac;
    if (rbac.loading && !rbac.data) {
      return `
        <article class="panel access-card wide rbac-card">
          <div class="panel-head"><h2>Funcoes e mandato do DM</h2>${chip('carregando', 'blue')}</div>
          <div class="panel-body"><div class="loader-line"></div></div>
        </article>
      `;
    }
    if (rbac.error) {
      return `
        <article class="panel access-card wide rbac-card">
          <div class="panel-head"><h2>Funcoes e mandato do DM</h2>${chip('atencao', 'orange')}</div>
          <div class="panel-body access-empty">
            <p>${esc(rbac.error)}</p>
            <button onclick="loadRbacAdmin(true)">Tentar de novo</button>
          </div>
        </article>
      `;
    }
    if (!rbac.data) {
      return `
        <article class="panel access-card wide rbac-card">
          <div class="panel-head"><h2>Funcoes e mandato do DM</h2>${chip('preparando', 'blue')}</div>
          <div class="panel-body"><div class="loader-line"></div></div>
        </article>
      `;
    }
    const data = rbac.data;
    const activeDm = rbacActiveDm();
    const activeAssignments = (data.assignments || []).filter(item => item.status === 'active');
    const canTechnical = canManageTechnicalRoles();
    return `
      <article class="panel access-card wide rbac-card">
        <div class="panel-head">
          <h2>Funcoes e mandato do DM</h2>
          <div class="badges">
            ${chip(`${activeAssignments.length} ativas`, 'blue')}
            ${chip(canTechnical ? 'admin tecnico' : 'admin campanha', canTechnical ? 'blue' : 'gold')}
          </div>
        </div>
        <div class="panel-body rbac-panel">
          <div class="rbac-summary">
            <div>
              <span class="label">DM atual</span>
              <strong>${esc(activeDm?.displayName || 'Sem DM ativo')}</strong>
              <small>${esc(activeDm?.roll20Name || activeDm?.discordHandle || 'mandato nao definido')}</small>
            </div>
            <button onclick="loadRbacAdmin(true)" ${rbac.loading || rbac.busy ? 'disabled' : ''}>Atualizar funcoes</button>
          </div>
          <div class="rbac-admin-grid">
            ${rbacTransferDmForm(activeDm)}
            ${rbacAssignRoleForm(canTechnical)}
          </div>
          <div class="rbac-section-head">
            <div>
              <span class="label">Atribuicoes</span>
              <h3>Funcoes ativas e historico recente</h3>
            </div>
            ${chip('DM transfere por mandato', 'gold')}
          </div>
          ${rbacAssignmentsList()}
        </div>
      </article>
    `;
  }

  function rbacTransferDmForm(activeDm) {
    return `
      <section class="rbac-box">
        <div class="rbac-box-head">
          <div>
            <span class="label">Mandato narrativo</span>
            <h3>Transferir DM</h3>
          </div>
          ${chip('canon final', 'gold')}
        </div>
        <div class="detail-grid access-form">
          <label><span class="label">Novo DM</span><select id="rbacNewDmProfile">${rbacProfileOptions(activeDm?.profileId || '')}</select></label>
          <label><span class="label">Motivo</span><input id="rbacDmReason" placeholder="Ex: troca oficial de DM da campanha" /></label>
          <div class="actions">
            <button class="primary" onclick="transferCampaignDm()" ${accessState.rbac.busy ? 'disabled' : ''}>Transferir DM</button>
          </div>
        </div>
      </section>
    `;
  }

  function rbacAssignRoleForm(canTechnical) {
    return `
      <section class="rbac-box">
        <div class="rbac-box-head">
          <div>
            <span class="label">Atribuicao</span>
            <h3>Adicionar funcao</h3>
          </div>
          ${chip(canTechnical ? 'projeto/campanha' : 'campanha', canTechnical ? 'blue' : 'green')}
        </div>
        <div class="detail-grid access-form">
          <label><span class="label">Perfil</span><select id="rbacAssignProfile">${rbacProfileOptions()}</select></label>
          <label><span class="label">Funcao</span><select id="rbacAssignRole" onchange="updateRbacScopeDefault()">${rbacRoleOptions()}</select></label>
          <div class="field-grid">
            <label><span class="label">Escopo</span><select id="rbacAssignScopeType" onchange="updateRbacScopeDefault()">
              ${canTechnical ? '<option value="project">Projeto</option>' : ''}
              <option value="campaign" ${canTechnical ? '' : 'selected'}>Campanha</option>
            </select></label>
            <label><span class="label">ID do escopo</span><input id="rbacAssignScopeId" value="${esc(canTechnical ? PROJECT_SCOPE_ID : CAMPAIGN_SLUG)}" readonly /></label>
          </div>
          <label><span class="label">Motivo</span><input id="rbacAssignReason" placeholder="Ex: jogador aprovado, operador tecnico, revisor temporario" /></label>
          <div class="actions">
            <button class="success" onclick="submitRbacAssignment()" ${accessState.rbac.busy ? 'disabled' : ''}>Adicionar funcao</button>
          </div>
        </div>
      </section>
    `;
  }

  function rbacAssignmentsList() {
    const assignments = accessState.rbac.data?.assignments || [];
    if (!assignments.length) return '<div class="empty">Nenhuma atribuicao registrada.</div>';
    return `
      <div class="rbac-assignments">
        ${assignments.map(assignment => rbacAssignmentCard(assignment)).join('')}
      </div>
    `;
  }

  function rbacAssignmentCard(assignment) {
    const isActive = assignment.status === 'active';
    const canRevoke = isActive && assignment.roleSlug !== 'campaign_dm';
    const scope = assignment.scopeType === 'project' ? 'Projeto' : assignment.scopeType === 'campaign' ? 'Campanha' : assignment.scopeType;
    return `
      <div class="job-row rbac-assignment ${isActive ? 'active' : 'inactive'}">
        <div class="row between">
          <div>
            <strong>${esc(assignment.displayName || 'Perfil')}</strong>
            <small>${esc(assignment.roll20Name || assignment.discordHandle || 'sem nick')} | ${esc(scope)}: ${esc(assignment.scopeId)}</small>
          </div>
          <div class="badges">
            ${chip(rbacRoleLabel(assignment.roleSlug), roleTone(assignment.roleSlug, assignment.plane))}
            ${chip(assignment.status, isActive ? 'green' : 'orange')}
          </div>
        </div>
        ${assignment.reason ? `<p>${esc(assignment.reason)}</p>` : ''}
        <small>Inicio: ${esc(formatRbacDate(assignment.startsAt))}${assignment.endsAt ? ` | Fim: ${esc(formatRbacDate(assignment.endsAt))}` : ''}${assignment.assignedBy ? ` | Por: ${esc(assignment.assignedBy)}` : ''}</small>
        ${canRevoke ? `
          <div class="actions">
            <button class="danger" onclick="revokeRbacAssignment('${esc(assignment.id)}')">Revogar</button>
          </div>
        ` : assignment.roleSlug === 'campaign_dm' && isActive ? '<small>Para trocar esta funcao, use Transferir DM.</small>' : ''}
      </div>
    `;
  }

  function formatRbacDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function updateRbacScopeDefault() {
    const roleSlug = q('#rbacAssignRole')?.value || '';
    const roles = accessState.rbac.data?.roles || [];
    const role = roles.find(item => item.slug === roleSlug);
    const scopeType = q('#rbacAssignScopeType');
    const scopeId = q('#rbacAssignScopeId');
    if (!scopeType || !scopeId) return;
    if (role?.plane === 'technical') {
      scopeType.value = 'project';
      scopeId.value = PROJECT_SCOPE_ID;
      return;
    }
    scopeType.value = 'campaign';
    scopeId.value = CAMPAIGN_SLUG;
  }

  async function submitAccessClaim() {
    const client = supabaseClient();
    if (!client || !authUser()) {
      window.toast?.('Entre com Google primeiro.');
      return;
    }
    const characters = (q('#accessCharacters')?.value || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    try {
      accessState.loading = true;
      renderAccessPanel();
      const { error } = await client.rpc('submit_profile_claim', {
        campaign_slug: CAMPAIGN_SLUG,
        target_profile_id: q('#accessTargetProfile')?.value || null,
        requested_display_name: q('#accessDisplayName')?.value || null,
        requested_roll20_name: q('#accessRoll20Name')?.value || null,
        requested_discord_id: q('#accessDiscordId')?.value || null,
        requested_discord_handle: q('#accessDiscordHandle')?.value || null,
        requested_character_names: characters,
        player_note: q('#accessPlayerNote')?.value || null
      });
      if (error) throw error;
      window.toast?.('Solicitacao enviada para o DM.');
      accessState.loaded = false;
      await loadAccessDirectory(true);
    } catch (error) {
      window.toast?.(error.message || String(error));
      accessState.error = error.message || String(error);
    } finally {
      accessState.loading = false;
      renderAccessPanel();
    }
  }

  async function reviewAccessClaim(claimId, decision) {
    const client = supabaseClient();
    if (!client || !authUser()) return;
    const note = q(`#reviewNote_${CSS.escape(claimId)}`)?.value || null;
    try {
      accessState.loading = true;
      renderAccessPanel();
      const { error } = await client.rpc('review_profile_claim', {
        claim_id: claimId,
        decision,
        review_note: note
      });
      if (error) throw error;
      window.toast?.(decision === 'approved' ? 'Vinculo aprovado.' : 'Solicitacao rejeitada.');
      accessState.loaded = false;
      await loadAccessDirectory(true);
      window.loadAuthProfile?.();
    } catch (error) {
      window.toast?.(error.message || String(error));
      accessState.error = error.message || String(error);
    } finally {
      accessState.loading = false;
      renderAccessPanel();
    }
  }

  async function submitRbacAssignment() {
    if (!authUser()) return;
    const profileId = q('#rbacAssignProfile')?.value || '';
    const roleSlug = q('#rbacAssignRole')?.value || '';
    const scopeType = q('#rbacAssignScopeType')?.value || 'campaign';
    const scopeId = q('#rbacAssignScopeId')?.value || (scopeType === 'project' ? PROJECT_SCOPE_ID : CAMPAIGN_SLUG);
    const reason = q('#rbacAssignReason')?.value || '';
    if (!profileId || !roleSlug) {
      window.toast?.('Escolha perfil e funcao.');
      return;
    }
    try {
      accessState.rbac.busy = true;
      renderAccessPanel();
      const payload = await window.api('/api/rbac/assign', {
        method: 'POST',
        body: JSON.stringify({
          campaignSlug: CAMPAIGN_SLUG,
          profileId,
          roleSlug,
          scopeType,
          scopeId,
          reason
        })
      });
      accessState.rbac.data = payload.rbac || accessState.rbac.data;
      accessState.rbac.loaded = true;
      accessState.rbac.error = null;
      window.toast?.('Funcao adicionada.');
      await Promise.all([
        loadRbacAdmin(true),
        loadAccessDirectory(true),
        window.loadAuthProfile?.()
      ]);
    } catch (error) {
      accessState.rbac.error = error.message || String(error);
      window.toast?.(accessState.rbac.error);
    } finally {
      accessState.rbac.busy = false;
      renderAccessPanel();
    }
  }

  async function revokeRbacAssignment(assignmentId) {
    if (!assignmentId) return;
    const assignment = (accessState.rbac.data?.assignments || []).find(item => item.id === assignmentId);
    const profileName = rbacProfileName(assignment?.profileId);
    const roleName = rbacRoleLabel(assignment?.roleSlug);
    const ok = window.confirm(`Revogar ${roleName} de ${profileName}?`);
    if (!ok) return;
    const reason = window.prompt('Motivo da revogacao', 'Revogado pela administracao de funcoes.') || '';
    try {
      accessState.rbac.busy = true;
      renderAccessPanel();
      const payload = await window.api('/api/rbac/revoke', {
        method: 'POST',
        body: JSON.stringify({
          campaignSlug: CAMPAIGN_SLUG,
          assignmentId,
          reason
        })
      });
      accessState.rbac.data = payload.rbac || accessState.rbac.data;
      accessState.rbac.loaded = true;
      accessState.rbac.error = null;
      window.toast?.('Funcao revogada.');
      await Promise.all([
        loadRbacAdmin(true),
        loadAccessDirectory(true),
        window.loadAuthProfile?.()
      ]);
    } catch (error) {
      accessState.rbac.error = error.message || String(error);
      window.toast?.(accessState.rbac.error);
    } finally {
      accessState.rbac.busy = false;
      renderAccessPanel();
    }
  }

  async function transferCampaignDm() {
    const newProfileId = q('#rbacNewDmProfile')?.value || '';
    const reason = q('#rbacDmReason')?.value || '';
    if (!newProfileId) {
      window.toast?.('Escolha o novo DM.');
      return;
    }
    const newName = rbacProfileName(newProfileId);
    const ok = window.confirm(`Transferir o mandato de DM para ${newName}?`);
    if (!ok) return;
    try {
      accessState.rbac.busy = true;
      renderAccessPanel();
      const payload = await window.api('/api/rbac/transfer-dm', {
        method: 'POST',
        body: JSON.stringify({
          campaignSlug: CAMPAIGN_SLUG,
          newProfileId,
          reason
        })
      });
      accessState.rbac.data = payload.rbac || accessState.rbac.data;
      accessState.rbac.loaded = true;
      accessState.rbac.error = null;
      window.toast?.('DM transferido.');
      await Promise.all([
        loadRbacAdmin(true),
        loadAccessDirectory(true),
        window.loadAuthProfile?.()
      ]);
    } catch (error) {
      accessState.rbac.error = error.message || String(error);
      window.toast?.(accessState.rbac.error);
    } finally {
      accessState.rbac.busy = false;
      renderAccessPanel();
    }
  }

  function patchRender() {
    if (window.__accessRenderPatched || typeof window.render !== 'function') return;
    window.__accessRenderPatched = true;
    const baseRender = window.render;
    window.render = function patchedRender() {
      ensureAccessTab();
      if (window.state?.tab === 'access') {
        renderAccessPanel();
        loadAccessDirectory(false);
        return;
      }
      return baseRender();
    };
  }

  window.accessState = accessState;
  window.loadAccessDirectory = loadAccessDirectory;
  window.loadRbacAdmin = loadRbacAdmin;
  window.submitAccessClaim = submitAccessClaim;
  window.reviewAccessClaim = reviewAccessClaim;
  window.submitRbacAssignment = submitRbacAssignment;
  window.revokeRbacAssignment = revokeRbacAssignment;
  window.transferCampaignDm = transferCampaignDm;
  window.updateRbacScopeDefault = updateRbacScopeDefault;

  ensureAccessTab();
  patchRender();
  window.setTimeout(() => {
    ensureAccessTab();
    patchRender();
    if (window.state?.tab === 'access') window.render();
  }, 0);
})();
