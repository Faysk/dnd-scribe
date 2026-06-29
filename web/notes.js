(function () {
  const CAMPAIGN_SLUG = 'yuhara-main';
  const notesState = {
    loading: false,
    loaded: false,
    error: null,
    directory: null,
    status: 'all',
    type: 'all'
  };

  const NOTE_TYPES = ['note', 'canon', 'npc', 'location', 'item', 'backstage', 'quote', 'question'];
  const VISIBILITIES = ['dm_review', 'table_private', 'player_visible', 'public_candidate'];
  const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'private', 'converted'];

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

  function badge(text, tone = '') {
    return `<span class="badge ${tone}">${esc(text)}</span>`;
  }

  function domId(id) {
    return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  function supabaseClient() {
    return window.state?.auth?.client || null;
  }

  function authUser() {
    return window.state?.auth?.user || null;
  }

  function ensureNotesTab() {
    const tabs = q('#tabs');
    if (!tabs) return;
    if (!tabs.querySelector('[data-tab="notes"]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.tab = 'notes';
      button.textContent = 'Notas';
      const access = tabs.querySelector('[data-tab="access"]');
      if (access) tabs.insertBefore(button, access);
      else tabs.appendChild(button);
    }
    window.syncTabsA11y?.();
  }

  async function loadNotesDirectory(force = false) {
    if (notesState.loading) return;
    if (notesState.loaded && !force) return;
    const client = supabaseClient();
    if (!client || !authUser()) {
      notesState.loaded = true;
      notesState.directory = null;
      notesState.error = null;
      renderNotesPanel();
      return;
    }
    notesState.loading = true;
    notesState.error = null;
    renderNotesPanel();
    try {
      const { data, error } = await client.rpc('table_notes_directory', {
        campaign_slug: CAMPAIGN_SLUG,
        source_session_id: window.state?.selectedSourceSessionId || null
      });
      if (error) throw error;
      notesState.directory = data;
      notesState.loaded = true;
    } catch (error) {
      notesState.error = error.message || String(error);
    } finally {
      notesState.loading = false;
      renderNotesPanel();
    }
  }

  function renderNotesPanel() {
    if (window.state?.tab !== 'notes') return;
    window.syncTabsA11y?.();
    const view = q('#view');
    if (!view) return;
    view.innerHTML = renderNotes();
  }

  function renderNotes() {
    if (!window.state?.auth?.ready) return shell('Notas da mesa', '<div class="loader-line"></div>');
    if (!authUser()) {
      return shell('Notas da mesa', `
        <div class="notes-empty">
          <p>Entre com Discord para ver notas salvas pela mesa. Google fica como alternativa.</p>
          <div class="auth-actions"><button class="primary" onclick="signInDiscord()">Entrar Discord</button><button onclick="signInGoogle()">Google</button></div>
        </div>
      `);
    }
    if (notesState.loading && !notesState.directory) return shell('Carregando notas...', '<div class="loader-line"></div>');
    if (notesState.error) {
      return shell('Notas da mesa', `
        <div class="notes-empty">
          <p>${esc(notesState.error)}</p>
          <button onclick="loadNotesDirectory(true)">Tentar de novo</button>
        </div>
      `);
    }
    if (!notesState.directory) {
      window.setTimeout(() => loadNotesDirectory(true), 0);
      return shell('Notas da mesa', '<div class="loader-line"></div>');
    }

    const notes = filteredNotes();
    const viewer = notesState.directory.viewer || {};
    return shell('Notas da mesa', `
      <section class="notes-toolbar">
        <select onchange="notesState.status=this.value; renderNotesPanel();">
          ${['all', ...REVIEW_STATUSES].map(status => `<option value="${status}" ${notesState.status === status ? 'selected' : ''}>${esc(status === 'all' ? 'Todos status' : status)}</option>`).join('')}
        </select>
        <select onchange="notesState.type=this.value; renderNotesPanel();">
          ${['all', ...NOTE_TYPES].map(type => `<option value="${type}" ${notesState.type === type ? 'selected' : ''}>${esc(type === 'all' ? 'Todos tipos' : type)}</option>`).join('')}
        </select>
        <button onclick="loadNotesDirectory(true)">Atualizar</button>
      </section>
      <section class="notes-grid">
        <article class="panel notes-summary">
          <div class="panel-head"><h2>Fila Discord</h2>${badge(`${notes.length}/${(notesState.directory.notes || []).length} notas`, 'blue')}</div>
          <div class="panel-body">
            <p>${viewer.canManageNotes ? 'Voce pode revisar, reclassificar e alterar visibilidade.' : 'Voce ve notas liberadas ou criadas por voce.'}</p>
            <div class="badges">${badge(viewer.role || 'sem papel', viewer.canManageNotes ? 'gold' : 'orange')}${badge('Discord', 'green')}</div>
          </div>
        </article>
        ${notes.map(noteCard).join('') || '<div class="notes-empty">Nenhuma nota encontrada para o filtro atual.</div>'}
      </section>
    `);
  }

  function shell(title, body) {
    return `
      <section class="notes-page">
        <div class="row between notes-title">
          <div>
            <span class="label">Discord</span>
            <h2>${esc(title)}</h2>
          </div>
          <div class="badges">${badge('slash commands', 'green')}${badge('context menu', 'blue')}${badge('DM review', 'gold')}</div>
        </div>
        ${body}
      </section>
    `;
  }

  function filteredNotes() {
    return (notesState.directory?.notes || []).filter(note => (
      (notesState.status === 'all' || note.reviewStatus === notesState.status)
      && (notesState.type === 'all' || note.noteType === notesState.type)
    ));
  }

  function optionList(values, selected) {
    return values.map(value => `<option value="${value}" ${value === selected ? 'selected' : ''}>${esc(value)}</option>`).join('');
  }

  function noteTone(note) {
    if (note.reviewStatus === 'approved' || note.reviewStatus === 'converted') return 'green';
    if (note.reviewStatus === 'rejected' || note.reviewStatus === 'private') return 'red';
    if (note.noteType === 'canon') return 'gold';
    return 'blue';
  }

  function noteCard(note) {
    const id = domId(note.id);
    const canManage = Boolean(notesState.directory?.viewer?.canManageNotes);
    return `
      <article class="panel note-card ${esc(note.reviewStatus || 'pending')}">
        <div class="panel-head">
          <div>
            <h2>${esc(note.authorName || note.authorDiscordId || 'Discord')}</h2>
            <small>${esc(note.session?.title || note.session?.sourceSessionId || 'sem sessao vinculada')} | ${esc(note.createdAt || '')}</small>
          </div>
          <div class="badges">${badge(note.noteType || 'note', noteTone(note))}${badge(note.reviewStatus || 'pending', noteTone(note))}</div>
        </div>
        <div class="panel-body note-body">
          ${canManage ? editableNote(note, id) : readonlyNote(note)}
        </div>
      </article>
    `;
  }

  function readonlyNote(note) {
    return `
      <p>${esc(note.content || '')}</p>
      <div class="badges">${badge(note.visibility || 'dm_review', 'orange')}${(note.tags || []).map(tag => badge(tag, 'blue')).join('')}</div>
      ${note.reviewNote ? `<small>Review: ${esc(note.reviewNote)}</small>` : ''}
    `;
  }

  function editableNote(note, id) {
    return `
      <div class="detail-grid note-editor">
        <label><span class="label">Conteudo</span><textarea id="noteContent_${id}">${esc(note.content || '')}</textarea></label>
        <div class="field-grid">
          <label><span class="label">Tipo</span><select id="noteType_${id}">${optionList(NOTE_TYPES, note.noteType || 'note')}</select></label>
          <label><span class="label">Visibilidade</span><select id="noteVisibility_${id}">${optionList(VISIBILITIES, note.visibility || 'dm_review')}</select></label>
          <label><span class="label">Status</span><select id="noteStatus_${id}">${optionList(REVIEW_STATUSES, note.reviewStatus || 'pending')}</select></label>
        </div>
        <label><span class="label">Tags</span><input id="noteTags_${id}" value="${esc((note.tags || []).join(', '))}" /></label>
        <label><span class="label">Nota de review</span><input id="noteReview_${id}" value="${esc(note.reviewNote || '')}" /></label>
        <div class="actions">
          <button class="success" onclick="reviewTableNote('${esc(note.id)}')">Salvar review</button>
          <button onclick="quickReviewTableNote('${esc(note.id)}', 'approved')">Aprovar</button>
          <button onclick="quickReviewTableNote('${esc(note.id)}', 'converted')">Convertida</button>
          <button class="danger" onclick="quickReviewTableNote('${esc(note.id)}', 'rejected')">Rejeitar</button>
        </div>
        <div class="badges">${badge(note.sourceSystem || 'discord', 'green')}${badge(note.sourceId || '-', 'blue')}</div>
      </div>
    `;
  }

  async function reviewTableNote(noteId, statusOverride = '') {
    const client = supabaseClient();
    if (!client || !authUser()) return;
    const id = domId(noteId);
    const tags = (q(`#noteTags_${id}`)?.value || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    try {
      notesState.loading = true;
      renderNotesPanel();
      const { error } = await client.rpc('review_table_note', {
        target_note_id: noteId,
        new_note_type: q(`#noteType_${id}`)?.value || null,
        new_visibility: q(`#noteVisibility_${id}`)?.value || null,
        new_review_status: statusOverride || q(`#noteStatus_${id}`)?.value || null,
        new_content: q(`#noteContent_${id}`)?.value || null,
        new_review_note: q(`#noteReview_${id}`)?.value || null,
        new_tags: tags
      });
      if (error) throw error;
      window.toast?.('Nota revisada.');
      notesState.loaded = false;
      await loadNotesDirectory(true);
    } catch (error) {
      notesState.error = error.message || String(error);
      window.toast?.(notesState.error);
    } finally {
      notesState.loading = false;
      renderNotesPanel();
    }
  }

  function quickReviewTableNote(noteId, status) {
    reviewTableNote(noteId, status);
  }

  function patchRender() {
    if (window.__notesRenderPatched || typeof window.render !== 'function') return;
    window.__notesRenderPatched = true;
    const baseRender = window.render;
    window.render = function patchedRender() {
      ensureNotesTab();
      if (window.state?.tab === 'notes') {
        renderNotesPanel();
        loadNotesDirectory(false);
        return;
      }
      return baseRender();
    };
  }

  window.notesState = notesState;
  window.loadNotesDirectory = loadNotesDirectory;
  window.renderNotesPanel = renderNotesPanel;
  window.reviewTableNote = reviewTableNote;
  window.quickReviewTableNote = quickReviewTableNote;

  ensureNotesTab();
  patchRender();
  window.setTimeout(() => {
    ensureNotesTab();
    patchRender();
    if (window.state?.tab === 'notes') window.render();
  }, 0);
})();
