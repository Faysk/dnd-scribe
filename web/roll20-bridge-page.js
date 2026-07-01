(function () {
  'use strict';

  const state = {
    ready: false,
    error: '',
    client: null,
    user: null,
    session: null,
    bridgeConfig: null,
    bridgeConfigError: ''
  };

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  }

  async function apiJson(path, options = {}) {
    const response = await fetch(path, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || `HTTP ${response.status}`);
    return payload;
  }

  function frame(label, title, body, actions = '', footer = '') {
    return [
      '<div class="site-gate-card">',
      '<div class="site-gate-brand">',
      '<div class="brand-mark">d20</div>',
      '<div><span class="label">' + escapeHtml(label) + '</span><h1>' + escapeHtml(title) + '</h1></div>',
      '</div>',
      '<p>' + escapeHtml(body) + '</p>',
      actions,
      footer ? '<small>' + escapeHtml(footer) + '</small>' : '',
      '</div>'
    ].join('');
  }

  function bridgeSelectedSourceSessionId() {
    const config = state.bridgeConfig || {};
    const recent = Array.isArray(config.recentSessions) ? config.recentSessions : [];
    return config.selectedSourceSessionId || config.suggestedSourceSessionId || recent[0]?.sourceSessionId || '';
  }

  function render() {
    const gate = document.getElementById('siteGate');
    const shell = document.getElementById('bridgeShell');
    const locked = !state.ready || !state.user;
    document.body.classList.toggle('auth-locked', locked);
    if (shell) shell.setAttribute('aria-hidden', locked ? 'true' : 'false');
    if (!gate) return;
    if (!locked) {
      gate.innerHTML = '';
      renderBridgeConfig();
      return;
    }
    if (!state.ready) {
      gate.innerHTML = frame('Roll20', 'Entrada da mesa', 'Conectando login seguro antes de abrir a ponte.', '<div class="loader-line"></div>');
      return;
    }
    if (state.error) {
      gate.innerHTML = frame('Acesso fechado', 'Login indisponivel', state.error, '<div class="site-gate-actions"><button class="primary" onclick="initBridgeAuth()">Tentar de novo</button></div>');
      return;
    }
    gate.innerHTML = frame(
      'Acesso fechado',
      'Entrada da mesa',
      'Entre para abrir a ponte Roll20. Discord e o login preferencial; Google fica como alternativa.',
      '<div class="site-gate-actions"><button class="primary discord-login" onclick="signInBridgeDiscord()">Entrar com Discord</button><button onclick="signInBridgeGoogle()">Entrar com Google</button></div>',
      'A rota de ingestao continua protegida por token dedicado.'
    );
  }

  function renderBridgeConfig() {
    const panel = document.getElementById('bridgeConfigPanel');
    if (!panel) return;
    if (state.bridgeConfigError) {
      panel.innerHTML = [
        '<span class="label">4. Copiar token e sessao alvo</span>',
        '<p>' + escapeHtml(state.bridgeConfigError) + '</p>',
        '<button onclick="loadBridgeConfig()">Tentar de novo</button>'
      ].join('');
      return;
    }
    if (!state.bridgeConfig) {
      panel.innerHTML = '<span class="label">4. Copiar token e sessao alvo</span><p>Carregando configuracao segura...</p>';
      return;
    }
    if (!state.bridgeConfig.tokenConfigured) {
      panel.innerHTML = '<span class="label">4. Copiar token e sessao alvo</span><p>ROLL20_BRIDGE_TOKEN ainda nao esta configurado em producao.</p>';
      return;
    }
    const recent = Array.isArray(state.bridgeConfig.recentSessions) ? state.bridgeConfig.recentSessions.filter(item => item.sourceSessionId) : [];
    const selectedSourceSessionId = bridgeSelectedSourceSessionId();
    panel.innerHTML = [
      '<span class="label">4. Copiar token e sessao alvo</span>',
      '<p>Disponivel somente para DM/Owner autenticado. Escolha a sessao alvo e use os botoes abaixo para preencher o painel da extensao no Roll20.</p>',
      recent.length ? [
        '<label><span class="label">Sessao alvo</span>',
        '<select onchange="setBridgeSourceSessionId(this.value)">',
        recent.map(session => '<option value="' + escapeHtml(session.sourceSessionId) + '" ' + (session.sourceSessionId === selectedSourceSessionId ? 'selected' : '') + '>' + escapeHtml((session.sessionDate || '-') + ' - ' + (session.title || session.sourceSessionId) + ' [' + (session.status || 'sem status') + ']') + '</option>').join(''),
        '</select></label>'
      ].join('') : '<p>Nenhuma sessao recente encontrada. Crie ou selecione uma sessao antes de ligar a ponte.</p>',
      '<div class="actions"><button class="primary" onclick="copyBridgeToken()">Copiar token</button><button onclick="copyBridgeSourceSessionId()">Copiar sourceSessionId</button><button onclick="copyBridgeDefaults()">Copiar config</button></div>',
      selectedSourceSessionId ? '<small>Prompt da extensao: URL = https://dnd.faysk.dev | campaignSlug = yuhara-main | sourceSessionId = ' + escapeHtml(selectedSourceSessionId) + ' | token = copiar pelo botao acima.</small>' : ''
    ].join('');
  }

  async function loadBridgeConfig(session = state.session) {
    state.bridgeConfigError = '';
    renderBridgeConfig();
    try {
      if (!session?.access_token) throw new Error('Sessao autenticada ausente.');
      const payload = await apiJson('/api/roll20-bridge/config?campaignSlug=yuhara-main', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      state.bridgeConfig = payload;
    } catch (error) {
      state.bridgeConfigError = error.message || String(error);
    }
    renderBridgeConfig();
  }

  async function initBridgeAuth() {
    state.ready = false;
    state.error = '';
    render();
    try {
      const config = await apiJson('/api/auth-config');
      if (!config.supabaseUrl || !config.publishableKey) throw new Error('Config publica do Supabase ausente.');
      if (!window.supabase?.createClient) throw new Error('Cliente Supabase nao carregou.');
      state.client = window.supabase.createClient(config.supabaseUrl, config.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      const { data, error } = await state.client.auth.getSession();
      if (error) throw error;
      state.session = data?.session || null;
      state.user = state.session?.user || null;
      state.client.auth.onAuthStateChange((_event, session) => {
        state.session = session || null;
        state.user = session?.user || null;
        state.ready = true;
        render();
        if (state.user) loadBridgeConfig(session);
      });
      if (state.user) await loadBridgeConfig(state.session);
    } catch (error) {
      state.error = error.message || String(error);
    } finally {
      state.ready = true;
      render();
    }
  }

  async function signInProvider(provider) {
    if (!state.client) return;
    const { error } = await state.client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) {
      state.error = error.message;
      render();
    }
  }

  window.initBridgeAuth = initBridgeAuth;
  window.signInBridgeDiscord = () => signInProvider('discord');
  window.signInBridgeGoogle = () => signInProvider('google');
  window.loadBridgeConfig = () => loadBridgeConfig();
  window.copyBridgeToken = async () => {
    const token = state.bridgeConfig?.bridgeToken || '';
    if (!token) return;
    await navigator.clipboard.writeText(token);
    const panel = document.getElementById('bridgeConfigPanel');
    if (panel) panel.querySelector('p').textContent = 'Token copiado.';
  };
  window.copyBridgeSourceSessionId = async () => {
    const sourceSessionId = bridgeSelectedSourceSessionId();
    if (!sourceSessionId) return;
    await navigator.clipboard.writeText(sourceSessionId);
    const panel = document.getElementById('bridgeConfigPanel');
    if (panel) panel.querySelector('p').textContent = 'sourceSessionId copiado.';
  };
  window.copyBridgeDefaults = async () => {
    const config = state.bridgeConfig || {};
    await navigator.clipboard.writeText(JSON.stringify({
      apiBase: config.apiBase || 'https://dnd.faysk.dev',
      campaignSlug: config.campaignSlug || 'yuhara-main',
      sourceSessionId: bridgeSelectedSourceSessionId()
    }, null, 2));
    const panel = document.getElementById('bridgeConfigPanel');
    if (panel) panel.querySelector('p').textContent = 'Config copiada.';
  };
  window.setBridgeSourceSessionId = value => {
    state.bridgeConfig = {
      ...(state.bridgeConfig || {}),
      selectedSourceSessionId: value || ''
    };
    renderBridgeConfig();
  };
  document.addEventListener('DOMContentLoaded', initBridgeAuth);
}());
