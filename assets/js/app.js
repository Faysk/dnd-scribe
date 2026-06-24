const demoData = {
  hotItems: [
    {
      type: 'Canon?',
      title: 'Ivory aceitou o duelo público',
      text: 'Fonte alinhada com Roll20 + fala do Mestre. Precisa validar regras do duelo.',
      tag: 'canon'
    },
    {
      type: 'Fala marcante',
      title: '“Esquecer não é o mesmo que matar.”',
      text: 'Provável fala do Dandelion durante a apresentação. Alta chance de virar quote oficial.',
      tag: 'quote'
    },
    {
      type: 'Bastidor',
      title: 'Astel prefeito de Euclix',
      text: 'Piada fora de personagem. Boa para corte, péssima para canon, graças aos deuses.',
      tag: 'ooc'
    }
  ],
  markers: [
    { time: '00:04:11', label: 'Início da sessão', note: 'Craig + OBS ativos' },
    { time: '00:39:24', label: 'Cena: Praça de Euclix', note: 'Dandelion prepara apresentação' },
    { time: '01:18:02', label: 'CANON?', note: 'Screaky aceita aparecer ao povo' },
    { time: '02:14:33', label: 'Roll20: duelo', note: 'Ivory responde desafio' },
    { time: '03:02:10', label: 'BASTIDOR', note: 'mesa quebra rindo do plano B' }
  ],
  segments: [
    {
      id: 'seg_001',
      time: '00:39:28',
      speaker: 'Dandelion',
      character: 'Dandelion',
      type: 'in_character',
      filter: 'quote canon',
      status: 'candidate',
      text: 'Eu não manipulo pessoas. Eu conduzo emoções. É diferente... juridicamente talvez não, mas artisticamente sim.'
    },
    {
      id: 'seg_002',
      time: '01:18:02',
      speaker: 'Screaky',
      character: 'Screaky',
      type: 'player_action',
      filter: 'canon',
      status: 'needs_review',
      text: 'Eu apareço quando ele terminar a música. Mostro as penas vermelhas, mas não ajoelho para ninguém.'
    },
    {
      id: 'seg_003',
      time: '01:46:44',
      speaker: 'Astel',
      character: 'Astel',
      type: 'in_character',
      filter: 'canon quote',
      status: 'candidate',
      text: 'Se os guardas avançarem antes dela falar, eles vão ter que passar por mim primeiro.'
    },
    {
      id: 'seg_004',
      time: '02:14:33',
      speaker: 'DM',
      character: 'Mestre',
      type: 'dm_narration',
      filter: 'canon',
      status: 'candidate',
      text: 'Ivory observa a multidão, sorri sem calor nenhum e aceita o duelo, desde que seja diante do povo.'
    },
    {
      id: 'seg_005',
      time: '02:16:09',
      speaker: 'Roll20',
      character: 'Sistema',
      type: 'mechanics',
      filter: 'mechanics',
      status: 'logged',
      text: 'Astel rola Persuasão/Intimidação: 1d20 + 8 = 27. Guardas hesitam e aguardam.'
    },
    {
      id: 'seg_006',
      time: '03:02:10',
      speaker: 'Jogador',
      character: 'Fora de personagem',
      type: 'ooc_chatter',
      filter: 'ooc',
      status: 'private',
      text: 'Mano, imagina o Astel prefeito de Euclix inaugurando praça com cara de velório.'
    },
    {
      id: 'seg_007',
      time: '04:11:59',
      speaker: 'DM',
      character: 'Mestre',
      type: 'dm_narration',
      filter: 'canon',
      status: 'needs_review',
      text: 'Ao fundo, algumas pessoas começam a repetir baixo o refrão da canção, como se estivessem reaprendendo a própria voz.'
    }
  ],
  candidates: [
    {
      title: 'Duelo público confirmado',
      text: 'Ivory aceitou enfrentar Screaky diante do povo de Euclix.',
      confidence: 88,
      source: '02:14:33–02:15:02',
      tag: 'canon'
    },
    {
      title: 'Canção saiu do controle do bardo',
      text: 'O povo começou a repetir o refrão sem Dandelion conduzir.',
      confidence: 73,
      source: '04:11:59–04:12:30',
      tag: 'interpretation'
    },
    {
      title: 'Astel segurou os guardas',
      text: 'A rolagem alta impediu interrupção imediata da apresentação.',
      confidence: 91,
      source: 'Roll20 + 02:16:09',
      tag: 'mechanics'
    }
  ],
  canonColumns: [
    {
      id: 'candidate',
      title: 'Candidatos',
      items: [
        { tag: 'Canon?', title: 'Ivory aceita duelo público', text: 'Precisa validar se foi condição oficial ou teatral.' },
        { tag: 'Canon?', title: 'Povo repete o refrão', text: 'Pode ser efeito narrativo importante da revolução.' }
      ]
    },
    {
      id: 'approved',
      title: 'Canon aprovado',
      items: [
        { tag: 'Aprovado', title: 'Screaky revelou penas vermelhas', text: 'Prova pública de identidade perante Euclix.' },
        { tag: 'Aprovado', title: 'Astel conteve os guardas', text: 'A rolagem foi registrada e impactou a cena.' }
      ]
    },
    {
      id: 'interpretation',
      title: 'Interpretação',
      items: [
        { tag: 'Tema', title: 'Dandelion tomou o público', text: 'Boa leitura simbólica, mas não é fato literal.' }
      ]
    },
    {
      id: 'published',
      title: 'Publicado',
      items: [
        { tag: 'Recap', title: 'Apresentação proibida', text: 'Resumo limpo pronto para o site público.' }
      ]
    }
  ],
  outtakes: [
    { type: 'aprovável', title: 'Prefeito Astel', text: '“Vou inaugurar essa praça em nome da Raven Queen. Não sorriam.”', private: false },
    { type: 'privado', title: 'Conversa pessoal', text: 'Marcado como não publicável. Fica guardado só como áudio bruto privado.', private: true },
    { type: 'aprovável', title: 'Plano B do Dandelion', text: 'Plano envolvia música, fumaça, mentira convincente e zero responsabilidade jurídica.', private: false },
    { type: 'técnico', title: 'Roll20 travou', text: 'Bastidor técnico útil apenas para cortar do recap.', private: true },
    { type: 'aprovável', title: 'A mesa perde a linha', text: 'Todo mundo rindo quando o plano “simples” virou golpe de Estado com trilha sonora.', private: false },
    { type: 'revisar', title: 'Piada sobre NPC', text: 'Engraçada, mas precisa aprovação antes de virar corte público.', private: false }
  ],
  entities: [
    { icon: '🦆', name: 'Dandelion', type: 'PC', text: 'Bardo fada/pato. Catalisador de memória, música e caos emocional.' },
    { icon: '🟥', name: 'Screaky', type: 'PC', text: 'Kenku/arara escarlate. Herdeira ligada a Euclix e à Fênix Vermelha.' },
    { icon: '🪶', name: 'Astel', type: 'PC', text: 'Shadar-kai ligado à Raven Queen, família Nightshade e proteção sombria.' },
    { icon: '❄️', name: 'Ivory', type: 'NPC', text: 'Rainha de Gelo e Espinhos. Controla Euclix por medo e narrativa.' },
    { icon: '🏰', name: 'Euclix', type: 'Lugar', text: 'Reino silenciado onde arte virou crime e canção virou revolução.' },
    { icon: '🚪', name: 'Porta do Kenku', type: 'Mistério', text: 'Relógio narrativo com olhos abrindo a cada retorno.' }
  ],
  music: [
    { n: '01', title: 'O Reino Vai Cantar', context: 'Hino revolucionário. Introduz a profecia sem revelar diretamente Screaky.', tags: ['revolução', 'Euclix', 'fênix'] },
    { n: '02', title: 'A Rainha de Penas Vermelhas', context: 'Revelação pública de Screaky como símbolo da fênix e da legitimidade roubada.', tags: ['Screaky', 'revelação', 'fogo'] },
    { n: '03', title: 'Mesa da Taverna', context: 'Espaço futuro para cortes de bastidores, reprises e versões populares das músicas.', tags: ['bastidor', 'cortes', 'público'] }
  ],
  pipeline: [
    { title: 'Criar sessão', detail: 'Título, arco, participantes, glossário e consentimento.' },
    { title: 'Capturar fontes', detail: 'Craig, OBS, Roll20 Logger e Discord markers.' },
    { title: 'Upload privado', detail: 'Supabase Storage ou R2, com metadados da sessão.' },
    { title: 'Transcrever', detail: 'OpenAI por faixa Craig, chunks com timestamps.' },
    { title: 'Classificar', detail: 'IA separa canon, fala, bastidor, mecânica e ruído.' },
    { title: 'Auditar', detail: 'Mestre e jogadores aprovam, corrigem ou rejeitam.' },
    { title: 'Publicar', detail: 'Recap, mudanças de canon, falas marcantes e cortes aprovados.' }
  ]
};

const titles = {
  dashboard: 'Agora',
  capture: 'Captura',
  review: 'Revisão',
  transcript: 'Transcrição',
  canon: 'Canon',
  outtakes: 'Bastidores',
  entities: 'Entidades',
  stage: 'Palco',
  ops: 'Operação',
  settings: 'Permissões'
};

const state = {
  currentFilter: 'all',
  dmMode: true
};

function qs(selector, root = document) { return root.querySelector(selector); }
function qsa(selector, root = document) { return [...root.querySelectorAll(selector)]; }

function showToast(message) {
  const toast = qs('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function switchView(viewId) {
  qsa('.view').forEach(view => view.classList.toggle('active', view.id === viewId));
  qsa('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewId));
  qs('#pageTitle').textContent = titles[viewId] || 'Yuhara Scribe';
  location.hash = viewId;
  qs('#mainNav')?.classList.remove('open');
}

function tagClass(tag) {
  if (['canon', 'Aprovado', 'Canon?', 'revolução', 'Euclix', 'fênix', 'fogo'].includes(tag)) return 'fire';
  if (['quote', 'Screaky', 'revelação'].includes(tag)) return 'blue';
  if (['interpretation', 'Tema', 'Mistério', 'público', 'cortes'].includes(tag)) return 'purple';
  if (['mechanics', 'PC'].includes(tag)) return 'green';
  return '';
}

function renderHotItems() {
  qs('#hotList').innerHTML = demoData.hotItems.map(item => `
    <article class="hot-card" data-search="${item.title} ${item.text} ${item.type}">
      <span class="tag ${tagClass(item.tag)}">${item.type}</span>
      <strong>${item.title}</strong>
      <p>${item.text}</p>
    </article>
  `).join('');
}

function renderMarkers() {
  qs('#markerList').innerHTML = demoData.markers.map(marker => `
    <div class="marker-item">
      <strong><span>${marker.label}</span><span>${marker.time}</span></strong>
      <small>${marker.note}</small>
    </div>
  `).join('');
}

function segmentTag(type) {
  const map = {
    in_character: 'Em personagem',
    player_action: 'Ação',
    dm_narration: 'Narração',
    mechanics: 'Mecânica',
    ooc_chatter: 'Fora de jogo'
  };
  return map[type] || type;
}

function renderReviewSegments() {
  const filter = state.currentFilter;
  const segments = demoData.segments.filter(seg => filter === 'all' || seg.filter.includes(filter));
  qs('#reviewSegments').innerHTML = segments.map(seg => `
    <article class="segment-card" data-segment-id="${seg.id}" data-search="${seg.text} ${seg.speaker} ${seg.type}">
      <div class="segment-head">
        <span>${seg.time} • ${seg.speaker}</span>
        <span class="tag ${tagClass(seg.filter.split(' ')[0])}">${segmentTag(seg.type)}</span>
      </div>
      <p>${seg.text}</p>
      <div class="segment-actions">
        <button class="mini-button" data-action="canon">Canon</button>
        <button class="mini-button" data-action="quote">Fala marcante</button>
        <button class="mini-button" data-action="hook">Gancho</button>
        <button class="mini-button" data-action="outtake">Bastidor</button>
        <button class="mini-button" data-action="reject">Rejeitar</button>
      </div>
    </article>
  `).join('');
}

function renderCandidates() {
  qs('#candidateList').innerHTML = demoData.candidates.map(c => `
    <article class="candidate-card" data-search="${c.title} ${c.text} ${c.source}">
      <span class="tag ${tagClass(c.tag)}">${c.tag}</span>
      <h4>${c.title}</h4>
      <p>${c.text}</p>
      <div class="confidence" title="Confiança ${c.confidence}%"><span style="width:${c.confidence}%"></span></div>
      <small class="muted">Fonte: ${c.source}</small>
      <div class="segment-actions">
        <button class="mini-button" data-action="approve">Aprovar</button>
        <button class="mini-button" data-action="edit">Editar</button>
        <button class="mini-button" data-action="reject">Rejeitar</button>
      </div>
    </article>
  `).join('');
}

function renderTranscriptTable() {
  const term = qs('#transcriptSearch')?.value?.toLowerCase() || '';
  const speaker = qs('#speakerFilter')?.value || 'all';
  const rows = demoData.segments.filter(seg => {
    const matchesSpeaker = speaker === 'all' || seg.speaker === speaker;
    const matchesTerm = !term || `${seg.time} ${seg.speaker} ${seg.type} ${seg.text} ${seg.status}`.toLowerCase().includes(term);
    return matchesSpeaker && matchesTerm;
  });
  qs('#transcriptTable').innerHTML = rows.map(seg => `
    <tr data-search="${seg.text} ${seg.speaker}">
      <td>${seg.time}</td>
      <td>${seg.speaker}</td>
      <td><span class="tag ${tagClass(seg.filter.split(' ')[0])}">${segmentTag(seg.type)}</span></td>
      <td>${seg.text}</td>
      <td>${seg.status}</td>
    </tr>
  `).join('');
}

function renderKanban() {
  qs('#kanbanBoard').innerHTML = demoData.canonColumns.map(column => `
    <section class="kanban-column">
      <div class="kanban-head"><h3>${column.title}</h3><span class="kanban-count">${column.items.length}</span></div>
      ${column.items.map(item => `
        <article class="kanban-card" data-search="${item.title} ${item.text} ${item.tag}">
          <span class="tag ${tagClass(item.tag)}">${item.tag}</span>
          <strong>${item.title}</strong>
          <p>${item.text}</p>
          <button class="mini-button" data-action="open-source">Ver fonte</button>
        </article>
      `).join('')}
    </section>
  `).join('');
}

function renderOuttakes() {
  qs('#outtakeGrid').innerHTML = demoData.outtakes.map(o => `
    <article class="outtake-card ${o.private ? 'private dm-sensitive' : ''}" data-search="${o.title} ${o.text} ${o.type}">
      <span class="tag ${o.private ? '' : 'blue'}">${o.type}</span>
      <h3>${o.title}</h3>
      <p class="quote-line">${o.text}</p>
      <div class="segment-actions">
        <button class="mini-button" data-action="approve-outtake">Aprovar corte</button>
        <button class="mini-button" data-action="private">Privado</button>
      </div>
    </article>
  `).join('');
}

function renderEntities() {
  qs('#entityGrid').innerHTML = demoData.entities.map(e => `
    <article class="entity-card" data-search="${e.name} ${e.type} ${e.text}">
      <div class="avatar">${e.icon}</div>
      <span class="tag ${tagClass(e.type)}">${e.type}</span>
      <h3>${e.name}</h3>
      <p>${e.text}</p>
      <button class="mini-button" data-action="entity-open">Abrir ficha</button>
    </article>
  `).join('');
}

function renderMusic() {
  qs('#musicGrid').innerHTML = demoData.music.map(track => `
    <article class="music-card" data-search="${track.title} ${track.context} ${track.tags.join(' ')}">
      <span class="track-number">${track.n}</span>
      <h3>${track.title}</h3>
      <p>${track.context}</p>
      <div class="tag-row">${track.tags.map(tag => `<span class="tag ${tagClass(tag)}">${tag}</span>`).join('')}</div>
      <div class="music-controls">
        <button class="secondary-button" data-action="play-track">Tocar mock</button>
        <button class="ghost-button" data-action="lyrics">Ver letra</button>
      </div>
    </article>
  `).join('');
}

function renderPipeline() {
  qs('#pipelineList').innerHTML = demoData.pipeline.map((step, index) => `
    <div class="pipeline-step">
      <div class="step-index">${index + 1}</div>
      <div><strong>${step.title}</strong><small>${step.detail}</small></div>
      <span class="tag ${index < 3 ? 'green' : index < 5 ? 'fire' : ''}">${index < 3 ? 'ok' : index < 5 ? 'fila' : 'pendente'}</span>
    </div>
  `).join('');
}

function toggleDMMode() {
  state.dmMode = !state.dmMode;
  qs('#dmModeBtn').textContent = state.dmMode ? 'Modo Mestre' : 'Modo Jogador';
  qsa('.dm-sensitive').forEach(el => el.classList.toggle('hidden-by-dm', !state.dmMode));
  showToast(state.dmMode ? 'Modo Mestre: conteúdo privado visível.' : 'Modo Jogador: conteúdo sensível oculto.');
}

function globalSearch() {
  const term = qs('#globalSearch').value.toLowerCase().trim();
  qsa('[data-search]').forEach(el => {
    const haystack = el.dataset.search.toLowerCase();
    el.style.display = !term || haystack.includes(term) ? '' : 'none';
  });
}

function buildExportText() {
  return `# Sessão XX — O Reino Prende a Respiração

## Recap curto
O povo de Euclix começou a recuperar a própria voz. Dandelion transformou a profecia em hino, Screaky surgiu como símbolo das penas vermelhas e Astel conteve a interrupção dos guardas enquanto Ivory aceitava o duelo diante do povo.

## Mudanças de canon aprovadas
- Screaky revelou publicamente as penas vermelhas.
- Astel impediu a interrupção imediata dos guardas.
- A apresentação proibida se tornou um ato político em Euclix.

## Candidatos ainda pendentes
- Confirmar se Ivory aceitou oficialmente o duelo público.
- Validar se o povo repetir o refrão já é efeito narrativo consolidado ou apenas clima da cena.

## Falas marcantes candidatas
> “Esquecer não é o mesmo que matar.”

## Bastidores aprováveis
- Piada do Astel prefeito de Euclix, se Arthur aprovar e não mandar a Raven Queen na nossa casa.
`;
}

function setupEvents() {
  qsa('.nav-item').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  qsa('[data-view-link]').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.viewLink)));

  qs('#themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
    html.dataset.theme = next;
    qs('#themeToggle').textContent = next === 'dark' ? 'Lua' : 'Sol';
    showToast(next === 'dark' ? 'Tema escuro ativado.' : 'Tema claro ativado.');
  });

  qs('#dmModeBtn').addEventListener('click', toggleDMMode);
  qs('#globalSearch').addEventListener('input', globalSearch);
  qs('#transcriptSearch')?.addEventListener('input', renderTranscriptTable);
  qs('#speakerFilter')?.addEventListener('change', renderTranscriptTable);

  qsa('.filter-chip').forEach(chip => chip.addEventListener('click', () => {
    qsa('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.currentFilter = chip.dataset.filter;
    renderReviewSegments();
  }));

  document.body.addEventListener('click', event => {
    const action = event.target?.dataset?.action;
    if (!action) return;
    const messages = {
      canon: 'Segmento marcado como candidato de canon. Agora falta o humano carimbar a papelada mágica.',
      quote: 'Fala marcada como candidata a frase lendária.',
      hook: 'Marcado como gancho futuro. O DM sorriu? Então estamos em perigo.',
      outtake: 'Trecho enviado para Bastidores. Não é canon, mas tem potencial de vergonha pública.',
      reject: 'Item rejeitado. Foi de base sem nem rolar death save.',
      approve: 'Candidato aprovado nesta demo. Na vida real, entra no audit log.',
      edit: 'Edição abriria painel lateral com fonte, texto e justificativa.',
      'open-source': 'Abriria o trecho exato de áudio/transcrição/Roll20.',
      'approve-outtake': 'Corte aprovado na demo. Em produção, exigiria aprovação dos envolvidos.',
      private: 'Trecho marcado como privado.',
      'entity-open': 'Abriria ficha completa com menções, relações e histórico.',
      'play-track': 'Mock de player: aqui tocaria a música ou preview aprovado.',
      lyrics: 'Abriria letra, contexto e impacto narrativo da música.'
    };
    showToast(messages[action] || 'Ação executada na demo.');
  });

  const dropzone = qs('#dropzone');
  ['dragenter', 'dragover'].forEach(evt => dropzone.addEventListener(evt, e => {
    e.preventDefault(); dropzone.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, e => {
    e.preventDefault(); dropzone.classList.remove('dragging');
    if (evt === 'drop') showToast('Arquivos simulados adicionados ao pacote da sessão.');
  }));

  qs('#mobileNavToggle').addEventListener('click', () => {
    const nav = qs('#mainNav');
    nav.classList.toggle('open');
    qs('#mobileNavToggle').setAttribute('aria-expanded', nav.classList.contains('open'));
  });

  qs('#exportBtn').addEventListener('click', () => {
    qs('#exportPreview').textContent = buildExportText();
    qs('#exportModal').showModal();
  });

  qs('#copyExport').addEventListener('click', e => {
    e.preventDefault();
    navigator.clipboard?.writeText(buildExportText());
    showToast('Export copiado. Agora é só colar no recap e fazer pose de arquivista sério.');
  });

  qs('#copyConsent')?.addEventListener('click', () => {
    const text = qs('.consent-box').innerText;
    navigator.clipboard?.writeText(text);
    showToast('Texto de consentimento copiado. Chato, necessário, salvador de tretas.');
  });
}

function init() {
  renderHotItems();
  renderMarkers();
  renderReviewSegments();
  renderCandidates();
  renderTranscriptTable();
  renderKanban();
  renderOuttakes();
  renderEntities();
  renderMusic();
  renderPipeline();
  setupEvents();
  const hash = location.hash.replace('#', '');
  if (hash && titles[hash]) switchView(hash);
}

init();
