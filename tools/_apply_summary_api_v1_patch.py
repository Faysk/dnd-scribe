import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected marker once, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


# Fix versioned unknown routes so every /api/v1/* request is terminated cleanly.
summary_api = ROOT / "lib" / "summary-api.js"
replace_once(
    summary_api,
    """  if (path.startsWith('/api/v1/')) {\n    await handleExternalSummaryGet(req, res, path, query, deps.getPool());\n    return true;\n  }\n""",
    """  if (path.startsWith('/api/v1/')) {\n    const handled = await handleExternalSummaryGet(req, res, path, query, deps.getPool());\n    if (handled === false) {\n      return sendApiError(res, httpError(404, 'Endpoint da API v1 nao encontrado.', 'not_found'));\n    }\n    return true;\n  }\n""",
    "summary-api unknown-route guard",
)

# Integrate the API module into the existing catch-all Vercel function. This avoids
# creating an additional serverless function (important on the current Vercel plan).
api_file = ROOT / "api" / "[...path].js"
replace_once(
    api_file,
    "const { recoverStaleJobs } = require('../lib/pipeline-recovery');\n",
    "const { recoverStaleJobs } = require('../lib/pipeline-recovery');\nconst { handleSummaryApiGet, handleSummaryApiPost } = require('../lib/summary-api');\n",
    "summary-api import",
)
replace_once(
    api_file,
    """async function handleGet(req, res, path, query) {\n  const campaign = query.get('campaignSlug') || DEFAULT_CAMPAIGN;\n  const sourceSessionId = query.get('sourceSessionId') || DEFAULT_SOURCE_SESSION;\n  const runId = query.get('runId') || DEFAULT_RUN;\n""",
    """async function handleGet(req, res, path, query) {\n  const campaign = query.get('campaignSlug') || DEFAULT_CAMPAIGN;\n  const sourceSessionId = query.get('sourceSessionId') || DEFAULT_SOURCE_SESSION;\n  const runId = query.get('runId') || DEFAULT_RUN;\n  if (await handleSummaryApiGet(req, res, path, query, {\n    getPool,\n    requirePermission,\n    sendJson,\n    defaultCampaign: DEFAULT_CAMPAIGN\n  })) return;\n""",
    "summary-api GET integration",
)
replace_once(
    api_file,
    """  const runId = body.runId || decisions.aiRunId || DEFAULT_RUN;\n  const dryRun = Boolean(body.dryRun);\n  if (path === '/api/library-import-local') {\n""",
    """  const runId = body.runId || decisions.aiRunId || DEFAULT_RUN;\n  const dryRun = Boolean(body.dryRun);\n  if (await handleSummaryApiPost(req, res, path, body, {\n    getPool,\n    requirePermission,\n    sendJson,\n    defaultCampaign: DEFAULT_CAMPAIGN\n  })) return;\n  if (path === '/api/library-import-local') {\n""",
    "summary-api POST integration",
)

# Add the Integrations workspace and API key dialogs to Edit.
index_file = ROOT / "web" / "central-local" / "index.html"
replace_once(
    index_file,
    """          <button class=\"workspace-tab hidden\" id=\"localWorkspaceTab\" type=\"button\" data-workspace=\"local\">Processamento local</button>\n          <button class=\"workspace-tab hidden\" id=\"permissionsWorkspaceTab\" type=\"button\" data-workspace=\"permissions\">Permissões</button>\n""",
    """          <button class=\"workspace-tab hidden\" id=\"localWorkspaceTab\" type=\"button\" data-workspace=\"local\">Processamento local</button>\n          <button class=\"workspace-tab hidden\" id=\"integrationsWorkspaceTab\" type=\"button\" data-workspace=\"integrations\">Integrações</button>\n          <button class=\"workspace-tab hidden\" id=\"permissionsWorkspaceTab\" type=\"button\" data-workspace=\"permissions\">Permissões</button>\n""",
    "integrations tab",
)
replace_once(
    index_file,
    """        <div id=\"localWorkspace\" class=\"hidden\">\n""",
    """        <div id=\"integrationsWorkspace\" class=\"hidden\">\n          <section class=\"system-panel workspace-panel api-integrations-panel\">\n            <div class=\"section-heading compact-heading\">\n              <div>\n                <p class=\"eyebrow\">INTEGRAÇÕES</p>\n                <h2>API de resumos</h2>\n              </div>\n              <div class=\"api-integrations-heading-actions\">\n                <a class=\"ghost\" href=\"/docs/api\" target=\"_blank\" rel=\"noopener\">Documentação ↗</a>\n                <button class=\"primary\" id=\"newApiKeyButton\" type=\"button\">+ Nova API Key</button>\n              </div>\n            </div>\n            <p class=\"lede compact-lede\">Crie credenciais independentes para bots, automações e serviços externos lerem somente os resumos já publicados. Nenhuma chave desta área libera áudio ou transcrição completa.</p>\n            <div class=\"api-integration-overview\">\n              <div><span>BASE URL</span><code>https://dnd.faysk.dev/api/v1</code></div>\n              <div><span>ESCOPO</span><code>summaries:read</code></div>\n              <div><span>LIMITE</span><strong>300 req/min por chave</strong></div>\n            </div>\n            <div class=\"api-key-list\" id=\"apiKeyList\"><p class=\"empty\">Abra esta área para carregar as credenciais.</p></div>\n          </section>\n        </div>\n\n        <div id=\"localWorkspace\" class=\"hidden\">\n""",
    "integrations workspace",
)
replace_once(
    index_file,
    """    <dialog id=\"cloudEditorDialog\" class=\"review-dialog cloud-editor-dialog\">\n""",
    """    <dialog id=\"apiKeyDialog\" class=\"review-dialog api-key-dialog\">\n      <form method=\"dialog\">\n        <p class=\"eyebrow\">NOVA INTEGRAÇÃO</p>\n        <h2>Criar API Key</h2>\n        <p class=\"muted\">A chave ficará presa a esta campanha e poderá ler somente resumos publicados.</p>\n        <label>\n          Nome da integração\n          <input id=\"apiKeyName\" maxlength=\"120\" placeholder=\"Ex.: Bot Discord da campanha\" />\n        </label>\n        <label>\n          Descrição\n          <textarea id=\"apiKeyDescription\" maxlength=\"1000\" placeholder=\"Onde esta chave será usada e quem é responsável por ela.\"></textarea>\n        </label>\n        <label>\n          Expiração\n          <select id=\"apiKeyExpiry\">\n            <option value=\"\">Sem expiração automática</option>\n            <option value=\"30\">30 dias</option>\n            <option value=\"90\">90 dias</option>\n            <option value=\"365\">1 ano</option>\n          </select>\n        </label>\n        <div class=\"api-scope-readonly\"><span>ESCOPO</span><code>summaries:read</code><small>Somente leitura dos resumos publicados.</small></div>\n        <div class=\"dialog-actions\">\n          <button value=\"cancel\" class=\"ghost\">Cancelar</button>\n          <button type=\"button\" id=\"createApiKeyButton\" class=\"primary\">Criar chave</button>\n        </div>\n      </form>\n    </dialog>\n\n    <dialog id=\"apiKeySecretDialog\" class=\"review-dialog api-key-secret-dialog\">\n      <form method=\"dialog\">\n        <p class=\"eyebrow\">SEGREDO GERADO</p>\n        <h2 id=\"apiKeySecretTitle\">Copie sua API Key</h2>\n        <div class=\"api-secret-warning\"><strong>Ela só será exibida agora.</strong><span>Guarde em um secret manager ou variável de ambiente. Não envie em chat, frontend ou repositório.</span></div>\n        <label>\n          API Key\n          <textarea id=\"apiKeySecretValue\" class=\"api-secret-value\" readonly rows=\"3\"></textarea>\n        </label>\n        <div class=\"dialog-actions\">\n          <button type=\"button\" id=\"copyApiKeyButton\" class=\"primary\">Copiar chave</button>\n          <button value=\"close\" class=\"ghost\">Já salvei</button>\n        </div>\n      </form>\n    </dialog>\n\n    <dialog id=\"cloudEditorDialog\" class=\"review-dialog cloud-editor-dialog\">\n""",
    "api key dialogs",
)

# Edit frontend state and behavior.
app_file = ROOT / "web" / "central-local" / "app.js"
replace_once(
    app_file,
    """    rbac: null,\n    workspace: \"content\",\n""",
    """    rbac: null,\n    apiKeys: null,\n    apiDocumentationUrl: \"/docs/api\",\n    workspace: \"content\",\n""",
    "api key state",
)
replace_once(
    app_file,
    """  $(\"#permissionsWorkspaceTab\").classList.toggle(\"hidden\", !state.cloud.capabilities.canManagePermissions);\n  $(\"#companionDownloadSection\").classList.toggle(\"hidden\", !state.cloud.capabilities.canDownloadCompanion);\n""",
    """  $(\"#permissionsWorkspaceTab\").classList.toggle(\"hidden\", !state.cloud.capabilities.canManagePermissions);\n  $(\"#integrationsWorkspaceTab\").classList.toggle(\"hidden\", !state.cloud.capabilities.canManagePermissions);\n  $(\"#companionDownloadSection\").classList.toggle(\"hidden\", !state.cloud.capabilities.canDownloadCompanion);\n""",
    "integrations tab capability",
)
replace_once(
    app_file,
    """  if (name === \"permissions\" && !state.cloud.capabilities.canManagePermissions) return;\n  state.cloud.workspace = name;\n  $(\"#cloudWorkspace\").classList.toggle(\"hidden\", name !== \"content\");\n  $(\"#localWorkspace\").classList.toggle(\"hidden\", name !== \"local\");\n  $(\"#permissionsWorkspace\").classList.toggle(\"hidden\", name !== \"permissions\");\n""",
    """  if (name === \"permissions\" && !state.cloud.capabilities.canManagePermissions) return;\n  if (name === \"integrations\" && !state.cloud.capabilities.canManagePermissions) return;\n  state.cloud.workspace = name;\n  $(\"#cloudWorkspace\").classList.toggle(\"hidden\", name !== \"content\");\n  $(\"#localWorkspace\").classList.toggle(\"hidden\", name !== \"local\");\n  $(\"#integrationsWorkspace\").classList.toggle(\"hidden\", name !== \"integrations\");\n  $(\"#permissionsWorkspace\").classList.toggle(\"hidden\", name !== \"permissions\");\n""",
    "integrations workspace selection",
)
replace_once(
    app_file,
    """  if (name === \"permissions\" && !state.cloud.rbac) {\n    await loadPermissions().catch((error) => {\n      $(\"#permissionsList\").innerHTML = `<div class=\"error-panel\">${escapeHtml(error.message)}</div>`;\n    });\n  }\n}\n\nconst featureRoles = {\n""",
    """  if (name === \"permissions\" && !state.cloud.rbac) {\n    await loadPermissions().catch((error) => {\n      $(\"#permissionsList\").innerHTML = `<div class=\"error-panel\">${escapeHtml(error.message)}</div>`;\n    });\n  }\n  if (name === \"integrations\" && !state.cloud.apiKeys) {\n    await loadApiKeys().catch((error) => {\n      $(\"#apiKeyList\").innerHTML = `<div class=\"error-panel\">${escapeHtml(error.message)}</div>`;\n    });\n  }\n}\n\nconst featureRoles = {\n""",
    "integration workspace lazy load",
)

api_functions = r'''
function formatApiKeyDate(value, fallback = "Nunca") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });
}

function apiKeyStatusLabel(status) {
  return ({ active: "ATIVA", revoked: "REVOGADA", expired: "EXPIRADA" }[status] || String(status || "").toUpperCase());
}

async function loadApiKeys() {
  if (!state.cloud.capabilities.canManagePermissions) return;
  $("#apiKeyList").innerHTML = '<p class="empty">Carregando API Keys…</p>';
  const payload = await cloudApi("/api/integrations/api-keys?campaignSlug=yuhara-main");
  state.cloud.apiKeys = payload.keys || [];
  state.cloud.apiDocumentationUrl = payload.documentationUrl || "/docs/api";
  renderApiKeys();
}

function renderApiKeys() {
  const target = $("#apiKeyList");
  const keys = state.cloud.apiKeys || [];
  if (!keys.length) {
    target.innerHTML = '<div class="api-key-empty"><strong>Nenhuma API Key criada.</strong><span>Crie uma credencial separada para cada bot ou serviço que for consumir os resumos.</span></div>';
    return;
  }
  target.innerHTML = keys.map((key) => `<article class="api-key-card ${escapeHtml(key.status)}">
    <div class="api-key-main">
      <div class="api-key-title-row">
        <strong>${escapeHtml(key.name || "Integração")}</strong>
        <span class="api-key-status ${escapeHtml(key.status)}">${escapeHtml(apiKeyStatusLabel(key.status))}</span>
      </div>
      ${key.description ? `<p>${escapeHtml(key.description)}</p>` : ""}
      <code>${escapeHtml(key.prefix || "dnd_live_")}••••••••••••••••</code>
      <div class="api-key-meta">
        <span>Escopo <strong>${escapeHtml((key.scopes || []).join(", "))}</strong></span>
        <span>Criada <strong>${escapeHtml(formatApiKeyDate(key.createdAt, "—"))}</strong></span>
        <span>Expira <strong>${escapeHtml(formatApiKeyDate(key.expiresAt))}</strong></span>
        <span>Último uso <strong>${escapeHtml(formatApiKeyDate(key.lastUsedAt, "Ainda não usada"))}</strong></span>
        <span>Requests <strong>${Number(key.requestCount || 0).toLocaleString("pt-BR")}</strong></span>
      </div>
    </div>
    <div class="api-key-actions">
      ${key.status === "active" ? `<button class="ghost api-key-rotate" type="button" data-key-id="${escapeHtml(key.id)}">Rotacionar</button>
      <button class="ghost danger-action api-key-revoke" type="button" data-key-id="${escapeHtml(key.id)}">Revogar</button>` : ""}
    </div>
  </article>`).join("");
  target.querySelectorAll(".api-key-rotate").forEach((button) => {
    button.addEventListener("click", () => rotateApiKey(button.dataset.keyId));
  });
  target.querySelectorAll(".api-key-revoke").forEach((button) => {
    button.addEventListener("click", () => revokeApiKey(button.dataset.keyId));
  });
}

function openApiKeyDialog() {
  $("#apiKeyName").value = "";
  $("#apiKeyDescription").value = "";
  $("#apiKeyExpiry").value = "";
  $("#apiKeyDialog").showModal();
  window.setTimeout(() => $("#apiKeyName").focus(), 0);
}

function showApiKeySecret(secret, title = "Copie sua API Key") {
  $("#apiKeySecretTitle").textContent = title;
  $("#apiKeySecretValue").value = secret || "";
  $("#apiKeySecretDialog").showModal();
  $("#apiKeySecretValue").select();
}

async function createApiKey() {
  const button = $("#createApiKeyButton");
  const name = $("#apiKeyName").value.trim();
  if (name.length < 2) {
    alert("Informe um nome para identificar esta integração.");
    $("#apiKeyName").focus();
    return;
  }
  const expiry = $("#apiKeyExpiry").value;
  button.disabled = true;
  button.textContent = "Criando…";
  try {
    const payload = await cloudApi("/api/integrations/api-keys", {
      method: "POST",
      body: JSON.stringify({
        campaignSlug: "yuhara-main",
        name,
        description: $("#apiKeyDescription").value.trim(),
        expiresInDays: expiry ? Number(expiry) : null,
        scopes: ["summaries:read"],
      }),
    });
    state.cloud.apiKeys = payload.keys || [];
    $("#apiKeyDialog").close();
    renderApiKeys();
    showApiKeySecret(payload.created?.secret, `API Key criada · ${name}`);
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Criar chave";
  }
}

async function revokeApiKey(keyId) {
  const key = (state.cloud.apiKeys || []).find((item) => item.id === keyId);
  const label = key?.name || key?.prefix || "esta API Key";
  if (!window.confirm(`Revogar ${label}?\n\nO consumidor começará a receber 401 imediatamente.`)) return;
  try {
    const payload = await cloudApi("/api/integrations/api-keys/revoke", {
      method: "POST",
      body: JSON.stringify({ campaignSlug: "yuhara-main", keyId }),
    });
    state.cloud.apiKeys = payload.keys || [];
    renderApiKeys();
  } catch (error) {
    alert(error.message);
  }
}

async function rotateApiKey(keyId) {
  const key = (state.cloud.apiKeys || []).find((item) => item.id === keyId);
  const label = key?.name || key?.prefix || "esta API Key";
  if (!window.confirm(`Rotacionar ${label}?\n\nA chave atual será revogada imediatamente. Só continue se puder atualizar o consumidor agora.`)) return;
  try {
    const payload = await cloudApi("/api/integrations/api-keys/rotate", {
      method: "POST",
      body: JSON.stringify({ campaignSlug: "yuhara-main", keyId }),
    });
    state.cloud.apiKeys = payload.keys || [];
    renderApiKeys();
    showApiKeySecret(payload.rotated?.secret, `Nova API Key · ${label}`);
  } catch (error) {
    alert(error.message);
  }
}

async function copyApiKeySecret() {
  const value = $("#apiKeySecretValue").value;
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    $("#copyApiKeyButton").textContent = "Copiada ✓";
    window.setTimeout(() => { $("#copyApiKeyButton").textContent = "Copiar chave"; }, 1600);
  } catch (_error) {
    $("#apiKeySecretValue").focus();
    $("#apiKeySecretValue").select();
    document.execCommand("copy");
  }
}

'''
replace_once(
    app_file,
    "async function downloadCompanion() {\n",
    api_functions + "async function downloadCompanion() {\n",
    "api key frontend functions",
)
replace_once(
    app_file,
    """$(\"#refreshPermissionsButton\").addEventListener(\"click\", () => {\n  loadPermissions().catch((error) => alert(error.message));\n});\ninitCloudAuth();\n""",
    """$(\"#refreshPermissionsButton\").addEventListener(\"click\", () => {\n  loadPermissions().catch((error) => alert(error.message));\n});\n$(\"#newApiKeyButton\").addEventListener(\"click\", openApiKeyDialog);\n$(\"#createApiKeyButton\").addEventListener(\"click\", createApiKey);\n$(\"#copyApiKeyButton\").addEventListener(\"click\", copyApiKeySecret);\ninitCloudAuth();\n""",
    "api key event listeners",
)

# Styles are self-contained and reuse the existing Edit palette/buttons.
styles_file = ROOT / "web" / "central-local" / "styles.css"
styles = styles_file.read_text(encoding="utf-8")
style_marker = "/* summary-api-v1-integrations */"
if style_marker not in styles:
    styles += r'''

/* summary-api-v1-integrations */
.api-integrations-heading-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}
.api-integration-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  margin: 28px 0;
  overflow: hidden;
  border: 1px solid var(--line);
  background: var(--line);
  border-radius: 12px;
}
.api-integration-overview > div {
  display: grid;
  gap: 8px;
  min-height: 90px;
  padding: 18px;
  background: var(--panel);
}
.api-integration-overview span,
.api-scope-readonly > span {
  color: var(--muted);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .13em;
}
.api-integration-overview code,
.api-scope-readonly code,
.api-key-card code,
.api-secret-value {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}
.api-integration-overview code { color: var(--gold-bright); overflow-wrap: anywhere; }
.api-key-list { display: grid; gap: 12px; }
.api-key-empty {
  display: grid;
  gap: 6px;
  padding: 24px;
  border: 1px dashed var(--line);
  color: var(--muted);
  border-radius: 12px;
}
.api-key-empty strong { color: var(--paper); }
.api-key-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 20px;
  padding: 20px;
  border: 1px solid var(--line);
  background: var(--panel);
  border-radius: 12px;
}
.api-key-card.revoked,
.api-key-card.expired { opacity: .7; }
.api-key-main { min-width: 0; }
.api-key-title-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.api-key-title-row > strong { font-size: 17px; }
.api-key-card p { max-width: 720px; margin: 8px 0; color: var(--muted); }
.api-key-card > .api-key-main > code {
  display: inline-block;
  max-width: 100%;
  margin-top: 10px;
  overflow: hidden;
  color: var(--gold-bright);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.api-key-status {
  padding: 4px 7px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .1em;
}
.api-key-status.active { color: #8fc49b; border-color: rgba(143,196,155,.35); }
.api-key-status.revoked,
.api-key-status.expired { color: #e59383; border-color: rgba(229,147,131,.32); }
.api-key-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-top: 15px;
  color: var(--muted);
  font-size: 11px;
}
.api-key-meta span { display: inline-flex; gap: 5px; }
.api-key-meta strong { color: var(--paper-soft); font-weight: 650; }
.api-key-actions { display: flex; flex-wrap: wrap; align-content: start; justify-content: flex-end; gap: 8px; }
.danger-action { color: #e59383 !important; }
.api-key-dialog,
.api-key-secret-dialog { width: min(600px, calc(100vw - 32px)); }
.api-key-dialog form,
.api-key-secret-dialog form { display: grid; gap: 16px; }
.api-key-dialog label,
.api-key-secret-dialog label { display: grid; gap: 7px; }
.api-key-dialog input,
.api-key-dialog textarea,
.api-key-dialog select,
.api-key-secret-dialog textarea {
  width: 100%;
  padding: 11px 12px;
  border: 1px solid var(--line);
  color: var(--paper);
  background: var(--ink-soft);
  border-radius: 8px;
}
.api-key-dialog textarea { min-height: 105px; resize: vertical; }
.api-scope-readonly {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 14px;
  padding: 14px;
  border: 1px solid var(--line);
  background: var(--ink-soft);
  border-radius: 9px;
}
.api-scope-readonly small { grid-column: 1 / -1; color: var(--muted); }
.api-secret-warning {
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  border-left: 3px solid #e59383;
  color: var(--muted);
  background: rgba(229,147,131,.08);
  border-radius: 0 8px 8px 0;
}
.api-secret-warning strong { color: var(--paper); }
.api-secret-value { min-height: 84px; resize: none; color: var(--gold-bright) !important; overflow-wrap: anywhere; }
@media (max-width: 760px) {
  .api-integration-overview { grid-template-columns: 1fr; }
  .api-key-card { grid-template-columns: 1fr; }
  .api-key-actions { justify-content: flex-start; }
  .api-integrations-heading-actions { justify-content: flex-start; }
}
'''
    styles_file.write_text(styles, encoding="utf-8")

# Public routes for the human docs and the machine-readable OpenAPI document.
vercel_file = ROOT / "vercel.json"
vercel = json.loads(vercel_file.read_text(encoding="utf-8"))
rewrites = vercel.setdefault("rewrites", [])
for rewrite in [
    {"source": "/docs/api", "destination": "/api-docs.html"},
    {"source": "/docs/api/", "destination": "/api-docs.html"},
    {"source": "/docs/api/openapi.yaml", "destination": "/openapi-summary-v1.yaml"},
]:
    if rewrite not in rewrites:
        rewrites.append(rewrite)
vercel_file.write_text(json.dumps(vercel, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# Make the API module and guard part of the normal quality gate.
package_file = ROOT / "package.json"
package = json.loads(package_file.read_text(encoding="utf-8"))
scripts = package["scripts"]
if "check:summary-api" not in scripts:
    scripts["check:summary-api"] = "node --check lib/summary-api.js && node tools/check_summary_api_guards.js"
if "npm run check:summary-api" not in scripts["check"]:
    scripts["check"] = scripts["check"].replace(" && npm run check:companion", " && npm run check:summary-api && npm run check:companion")
package_file.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("Summary API v1 integration patch applied.")
