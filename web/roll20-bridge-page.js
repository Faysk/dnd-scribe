(function () {
  'use strict';

  const state = {
    ready: false,
    error: '',
    client: null,
    user: null
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

  function render() {
    const gate = document.getElementById('siteGate');
    const shell = document.getElementById('bridgeShell');
    const locked = !state.ready || !state.user;
    document.body.classList.toggle('auth-locked', locked);
    if (shell) shell.setAttribute('aria-hidden', locked ? 'true' : 'false');
    if (!gate) return;
    if (!locked) {
      gate.innerHTML = '';
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
      state.user = data?.session?.user || null;
      state.client.auth.onAuthStateChange((_event, session) => {
        state.user = session?.user || null;
        state.ready = true;
        render();
      });
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
  document.addEventListener('DOMContentLoaded', initBridgeAuth);
}());
