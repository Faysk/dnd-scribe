from pathlib import Path


js_path = Path("web/library.js")
js = js_path.read_text(encoding="utf-8")

old = "const PAGE_SIZE = 120;\n"
new = "const PAGE_SIZE = 120;\nconst TRANSCRIPT_PREFETCH_MARGIN = '1200px 0px';\n\nlet transcriptAutoLoadObserver = null;\n"
if js.count(old) != 1:
    raise SystemExit(f"expected PAGE_SIZE marker once, found {js.count(old)}")
js = js.replace(old, new, 1)

marker = "function renderReader() {\n"
helpers = r'''function transcriptLoadedLabel(reader = state.reader) {
  return reader.query || reader.speaker
    ? `${reader.segments.length.toLocaleString('pt-BR')} resultado${reader.segments.length === 1 ? '' : 's'}`
    : `${reader.segments.length.toLocaleString('pt-BR')} de ${reader.total.toLocaleString('pt-BR')} falas`;
}

function disconnectTranscriptAutoLoad() {
  if (!transcriptAutoLoadObserver) return;
  transcriptAutoLoadObserver.disconnect();
  transcriptAutoLoadObserver = null;
}

function transcriptLoadMoreMarkup(reader = state.reader) {
  if (reader.loadError) {
    return `<button class="secondary-button" type="button" data-load-more>Tentar carregar novamente</button>`;
  }
  return `<span class="load-more-status">${reader.loading ? 'Carregando mais falas…' : ''}</span>`;
}

function updateTranscriptLoadMore() {
  const reader = state.reader;
  const count = document.querySelector('[data-transcript-status-count]');
  if (count) count.textContent = transcriptLoadedLabel(reader);

  let sentinel = document.querySelector('[data-transcript-sentinel]');
  if (!reader.cursor) {
    disconnectTranscriptAutoLoad();
    sentinel?.remove();
    return;
  }

  if (!sentinel) {
    const list = document.querySelector('#transcriptList');
    if (!list) return;
    list.insertAdjacentHTML(
      'afterend',
      `<div class="load-more" data-transcript-sentinel aria-live="polite" aria-busy="${reader.loading ? 'true' : 'false'}"></div>`
    );
    sentinel = document.querySelector('[data-transcript-sentinel]');
  }

  sentinel.setAttribute('aria-busy', reader.loading ? 'true' : 'false');
  sentinel.innerHTML = transcriptLoadMoreMarkup(reader);
}

function setupTranscriptAutoLoad() {
  disconnectTranscriptAutoLoad();
  const reader = state.reader;
  const sentinel = document.querySelector('[data-transcript-sentinel]');
  if (!sentinel || !reader.cursor || reader.loading || reader.loadError) return;

  if (!('IntersectionObserver' in window)) {
    sentinel.innerHTML = '<button class="secondary-button" type="button" data-load-more>Carregar mais falas</button>';
    return;
  }

  transcriptAutoLoadObserver = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting) || reader.loading || !reader.cursor) return;
    disconnectTranscriptAutoLoad();
    loadTranscript({ append: true }).catch(error => {
      reader.loadError = error?.message || String(error);
      updateTranscriptLoadMore();
      showToast(reader.loadError);
    });
  }, { rootMargin: TRANSCRIPT_PREFETCH_MARGIN });
  transcriptAutoLoadObserver.observe(sentinel);
}

function appendTranscriptRows(segments = []) {
  const list = document.querySelector('#transcriptList');
  if (!list) {
    renderReader();
    return;
  }
  if (segments.length) {
    list.insertAdjacentHTML('beforeend', segments.map(transcriptRow).join(''));
  }
  updateTranscriptLoadMore();
  setupTranscriptAutoLoad();
}

'''
if js.count(marker) != 1:
    raise SystemExit(f"expected renderReader marker once, found {js.count(marker)}")
js = js.replace(marker, helpers + marker, 1)

old = "  const loadedLabel = reader.query || reader.speaker\n    ? `${reader.segments.length.toLocaleString('pt-BR')} resultado${reader.segments.length === 1 ? '' : 's'}`\n    : `${reader.segments.length.toLocaleString('pt-BR')} de ${reader.total.toLocaleString('pt-BR')} falas`;\n"
new = "  const loadedLabel = transcriptLoadedLabel(reader);\n"
if js.count(old) != 1:
    raise SystemExit(f"expected loadedLabel block once, found {js.count(old)}")
js = js.replace(old, new, 1)

old = "        <span>${escapeHtml(loadedLabel)}</span>\n"
new = "        <span data-transcript-status-count>${escapeHtml(loadedLabel)}</span>\n"
if js.count(old) != 1:
    raise SystemExit(f"expected transcript status span once, found {js.count(old)}")
js = js.replace(old, new, 1)

old = '''      ${reader.cursor ? `
        <div class="load-more">
          <button class="secondary-button" type="button" data-load-more ${reader.loading ? 'disabled' : ''}>
            ${reader.loading ? 'Carregando…' : 'Carregar mais falas'}
          </button>
        </div>
      ` : ''}
'''
new = '''      ${reader.cursor ? `
        <div class="load-more" data-transcript-sentinel aria-live="polite" aria-busy="${reader.loading ? 'true' : 'false'}">
          ${transcriptLoadMoreMarkup(reader)}
        </div>
      ` : ''}
'''
if js.count(old) != 1:
    raise SystemExit(f"expected manual load-more block once, found {js.count(old)}")
js = js.replace(old, new, 1)

old = '''      ${!reader.segments.length ? '<section class="empty-state"><h2>Nenhuma fala encontrada</h2><p>Tente outro termo ou remova o filtro de personagem.</p></section>' : ''}
    </article>
  `;
}
'''
new = '''      ${!reader.segments.length ? '<section class="empty-state"><h2>Nenhuma fala encontrada</h2><p>Tente outro termo ou remova o filtro de personagem.</p></section>' : ''}
    </article>
  `;
  setupTranscriptAutoLoad();
}
'''
if js.count(old) != 1:
    raise SystemExit(f"expected renderReader ending once, found {js.count(old)}")
js = js.replace(old, new, 1)

old = r'''async function loadTranscript({ append = false } = {}) {
  const reader = state.reader;
  if (reader.loading) return;
  reader.loading = true;
  if (!append) {
    reader.segments = [];
    reader.cursor = null;
  }
  renderReader();
  const params = new URLSearchParams({
    campaignSlug: CAMPAIGN_SLUG,
    sourceSessionId: reader.sourceSessionId,
    limit: String(PAGE_SIZE)
  });
  if (append && reader.cursor) params.set('cursor', reader.cursor);
  if (reader.query) params.set('q', reader.query);
  if (reader.speaker) params.set('speaker', reader.speaker);
  try {
    const payload = await api(`/api/library-transcript?${params}`);
    reader.session = payload.session;
    reader.speakers = payload.speakers || [];
    reader.total = Number(payload.total || 0);
    reader.segments = append
      ? [...reader.segments, ...(payload.segments || [])]
      : (payload.segments || []);
    reader.cursor = payload.nextCursor || null;
  } finally {
    reader.loading = false;
  }
  renderReader();
}
'''
new = r'''async function loadTranscript({ append = false } = {}) {
  const reader = state.reader;
  if (reader.loading || (append && !reader.cursor)) return;
  reader.loading = true;
  reader.loadError = '';
  if (!append) {
    reader.segments = [];
    reader.cursor = null;
    renderReader();
  } else {
    disconnectTranscriptAutoLoad();
    updateTranscriptLoadMore();
  }

  const params = new URLSearchParams({
    campaignSlug: CAMPAIGN_SLUG,
    sourceSessionId: reader.sourceSessionId,
    limit: String(PAGE_SIZE)
  });
  if (append && reader.cursor) params.set('cursor', reader.cursor);
  if (reader.query) params.set('q', reader.query);
  if (reader.speaker) params.set('speaker', reader.speaker);

  let pageSegments = [];
  try {
    const payload = await api(`/api/library-transcript?${params}`);
    reader.session = payload.session;
    reader.speakers = payload.speakers || [];
    reader.total = Number(payload.total || 0);

    const incoming = payload.segments || [];
    if (append) {
      const existingIds = new Set(reader.segments.map(segment => String(segment.id)));
      pageSegments = incoming.filter(segment => !existingIds.has(String(segment.id)));
      reader.segments = [...reader.segments, ...pageSegments];
    } else {
      pageSegments = incoming;
      reader.segments = incoming;
    }
    reader.cursor = payload.nextCursor || null;
  } catch (error) {
    if (append) reader.loadError = error?.message || String(error);
    throw error;
  } finally {
    reader.loading = false;
    if (append) updateTranscriptLoadMore();
  }

  if (append) appendTranscriptRows(pageSegments);
  else renderReader();
}
'''
if js.count(old) != 1:
    raise SystemExit(f"expected loadTranscript function once, found {js.count(old)}")
js = js.replace(old, new, 1)

old = "function renderError(error, retry = 'route') {\n  app.innerHTML = `\n"
new = "function renderError(error, retry = 'route') {\n  disconnectTranscriptAutoLoad();\n  app.innerHTML = `\n"
if js.count(old) != 1:
    raise SystemExit(f"expected renderError marker once, found {js.count(old)}")
js = js.replace(old, new, 1)

old = "function renderSummary() {\n  const session = state.reader.session;\n"
new = "function renderSummary() {\n  disconnectTranscriptAutoLoad();\n  const session = state.reader.session;\n"
if js.count(old) != 1:
    raise SystemExit(f"expected renderSummary marker once, found {js.count(old)}")
js = js.replace(old, new, 1)

old = "function renderHome() {\n  showAuthenticatedHeader();\n"
new = "function renderHome() {\n  disconnectTranscriptAutoLoad();\n  showAuthenticatedHeader();\n"
if js.count(old) != 1:
    raise SystemExit(f"expected renderHome marker once, found {js.count(old)}")
js = js.replace(old, new, 1)

js_path.write_text(js, encoding="utf-8")

css_path = Path("web/library.css")
css = css_path.read_text(encoding="utf-8")
old = '''.load-more {
  display: flex;
  justify-content: center;
  margin-top: 28px;
}

.load-more button {
  min-width: 180px;
}
'''
new = '''.load-more {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  margin-top: 28px;
  color: var(--muted);
  font-size: 12px;
}

.load-more-status {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  gap: 9px;
}

.load-more-status:not(:empty)::before {
  width: 12px;
  height: 12px;
  border: 2px solid var(--line);
  border-top-color: var(--gold);
  border-radius: 50%;
  content: "";
  animation: transcript-load-spin 0.8s linear infinite;
}

.load-more button {
  min-width: 180px;
}

@keyframes transcript-load-spin {
  to { transform: rotate(360deg); }
}
'''
if css.count(old) != 1:
    raise SystemExit(f"expected load-more CSS block once, found {css.count(old)}")
css_path.write_text(css.replace(old, new, 1), encoding="utf-8")
