(function () {
  const CAMPAIGN_SLUG = 'yuhara-main';
  const accessState = {
    loading: false,
    loaded: false,
    error: null,
    directory: null
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

  function ensureAccessTab() {
    const tabs = q('#tabs');
    if (!tabs || tabs.querySelector('[data-tab="access"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.tab = 'access';
    button.textContent = 'Acesso';
    tabs.appendChild(button);
  }

  function supabaseClient() {
    return window.state?.auth?.client || null;
  }

  function authUser() {
    return window.state?.auth?.user || null;
  }

  function googleName() {
    const user = authUser();
    return user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || '';
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
    document.querySelectorAll('#tabs button').forEach(button => {
      button.classList.toggle('active', button.dataset.tab === 'access');
    });
    const view = q('#view');
    if (!view) return;
    view.innerHTML = renderAccess();
  }

  function renderAccess() {
    const user = authUser();
    if (!window.state?.auth?.ready) {
      return accessShell('Conectando login Google...', '<div class="loader-line"></div>');
    }
    if (!user) {
      return accessShell('Entrar na mesa', `
        <div class="access-empty">
          <p>Entre com Google para vincular seu perfil da mesa, Discord e personagens.</p>
          <button class="primary" onclick="signInGoogle()">Entrar Google</button>
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
    const canManage = Boolean(viewer.canManageAccess);
    return accessShell('Acesso da mesa', `
      <section class="access-grid">
        <article class="panel access-card wide">
          <div class="panel-head">
            <h2>Seu login</h2>
            <div class="badges">
              ${chip('Google', 'green')}
              ${chip(roleLabel(viewer.campaignRole), canManage ? 'gold' : viewer.campaignRole ? 'blue' : 'orange')}
            </div>
          </div>
          <div class="panel-body access-profile-summary">
            <strong>${esc(viewer.displayName || googleName() || user.email)}</strong>
            <small>${viewer.profileId ? 'Perfil da mesa vinculado.' : 'Google conectado; perfil da mesa ainda pendente.'}</small>
            <div class="actions">
              <button onclick="loadAccessDirectory(true)">Atualizar</button>
              <button onclick="signOutGoogle()">Sair</button>
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
    return `
      <div class="detail-grid access-form">
        ${existing ? `<div class="empty">Voce ja tem uma solicitacao pendente. Enviar de novo atualiza a mesma solicitacao.</div>` : ''}
        <label><span class="label">Perfil alvo</span><select id="accessTargetProfile">${profileOptions()}</select></label>
        <div class="field-grid">
          <label><span class="label">Nome na vida</span><input id="accessDisplayName" value="${esc(googleName())}" placeholder="Nome preferido" /></label>
          <label><span class="label">Nick Roll20/Craig</span><input id="accessRoll20Name" placeholder="ex: faysk" /></label>
          <label><span class="label">Discord ID</span><input id="accessDiscordId" placeholder="ID numerico, se souber" /></label>
          <label><span class="label">Discord handle</span><input id="accessDiscordHandle" placeholder="ex: faysk" /></label>
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
  window.submitAccessClaim = submitAccessClaim;
  window.reviewAccessClaim = reviewAccessClaim;

  ensureAccessTab();
  patchRender();
  window.setTimeout(() => {
    ensureAccessTab();
    patchRender();
    if (window.state?.tab === 'access') window.render();
  }, 0);
})();
