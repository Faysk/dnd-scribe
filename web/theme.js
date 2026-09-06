(() => {
  const STORAGE_KEY = "dnd-scribe-theme";
  const PUBLIC_HOSTNAME = "dnd.faysk.dev";
  const TRANSCRIPT_ROLE = "transcript_viewer";
  const TRANSCRIPT_PERMISSION = "campaign.transcript.read";
  const root = document.documentElement;
  const validThemes = new Set(["light", "dark"]);
  const nativeFetch = window.fetch.bind(window);
  let latestRbac = null;
  let transcriptAllowed = null;
  let lastAuthorization = "";
  let permissionPatchTimer = null;

  function isEditPath(pathname = window.location.pathname) {
    return pathname === "/edit" || pathname.startsWith("/edit/") || pathname === "/central-local" || pathname.startsWith("/central-local/");
  }

  function normalizeEditOrigin() {
    if (!isEditPath() || window.location.hostname === PUBLIC_HOSTNAME) return false;
    if (!window.location.hostname.endsWith(".vercel.app")) return false;

    const target = new URL("/edit/", `https://${PUBLIC_HOSTNAME}`);
    target.search = window.location.search;
    target.hash = window.location.hash;
    window.location.replace(target.toString());
    return true;
  }

  function parseCookieJar() {
    return document.cookie.split(";").reduce((cookies, entry) => {
      const separator = entry.indexOf("=");
      if (separator < 0) return cookies;
      const name = entry.slice(0, separator).trim();
      const rawValue = entry.slice(separator + 1).trim();
      if (!name) return cookies;
      try {
        cookies.set(name, decodeURIComponent(rawValue));
      } catch (_error) {
        cookies.set(name, rawValue);
      }
      return cookies;
    }, new Map());
  }

  function readChunkedCookie(name) {
    const cookies = parseCookieJar();
    if (cookies.has(name)) return cookies.get(name) || "";

    let combined = "";
    for (let index = 0; index < 20; index += 1) {
      const chunk = cookies.get(`${name}.${index}`);
      if (typeof chunk !== "string") break;
      combined += chunk;
    }
    return combined;
  }

  function decodeBase64Url(value) {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = window.atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function readSsrSession(supabaseUrl) {
    let projectRef = "";
    try {
      projectRef = new URL(supabaseUrl).hostname.split(".")[0] || "";
    } catch (_error) {
      return null;
    }
    if (!projectRef) return null;

    const rawCookie = readChunkedCookie(`sb-${projectRef}-auth-token`);
    if (!rawCookie) return null;

    try {
      const serialized = rawCookie.startsWith("base64-")
        ? decodeBase64Url(rawCookie.slice("base64-".length))
        : rawCookie;
      const session = JSON.parse(serialized);
      if (!session || typeof session !== "object" || typeof session.access_token !== "string") return null;
      return session;
    } catch (_error) {
      return null;
    }
  }

  function sessionNeedsRefresh(session) {
    const expiresAt = Number(session?.expires_at || 0);
    return !session?.access_token || (expiresAt && expiresAt * 1000 - Date.now() <= 90_000);
  }

  async function refreshSsrSession() {
    try {
      await fetch("/api/web/health", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
    } catch (_error) {
      // The existing Edit login state will handle a genuinely unavailable session.
    }
  }

  function installEditSsrAuthBridge(namespace) {
    if (!isEditPath() || !namespace || typeof namespace.createClient !== "function") return namespace;
    if (namespace.__dndSsrBridgeInstalled) return namespace;

    const originalCreateClient = namespace.createClient.bind(namespace);
    namespace.createClient = function createClientWithSsrSession(supabaseUrl, publishableKey, options) {
      const client = originalCreateClient(supabaseUrl, publishableKey, options);
      if (!client?.auth || typeof client.auth.getSession !== "function") return client;

      const originalGetSession = client.auth.getSession.bind(client.auth);
      client.auth.getSession = async (...args) => {
        let session = readSsrSession(supabaseUrl);
        if (sessionNeedsRefresh(session)) {
          await refreshSsrSession();
          session = readSsrSession(supabaseUrl);
        }
        if (session?.access_token) return { data: { session }, error: null };
        return originalGetSession(...args);
      };
      return client;
    };
    Object.defineProperty(namespace, "__dndSsrBridgeInstalled", { value: true });
    return namespace;
  }

  function prepareEditSsrAuthBridge() {
    if (!isEditPath()) return;

    let supabaseNamespace = window.supabase;
    if (supabaseNamespace) {
      installEditSsrAuthBridge(supabaseNamespace);
      return;
    }

    Object.defineProperty(window, "supabase", {
      configurable: true,
      enumerable: true,
      get() {
        return supabaseNamespace;
      },
      set(value) {
        supabaseNamespace = installEditSsrAuthBridge(value);
      },
    });
  }

  function requestUrl(input) {
    try {
      const raw = input instanceof Request ? input.url : String(input || "");
      return new URL(raw, window.location.origin);
    } catch (_error) {
      return null;
    }
  }

  function requestHeaders(input, options) {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(options?.headers || {}).forEach((value, key) => headers.set(key, value));
    return headers;
  }

  function hasTranscriptPermission(payload) {
    const permissions = payload?.rbac?.permissions;
    return Array.isArray(permissions) && permissions.some((permission) => (
      permission?.action === TRANSCRIPT_PERMISSION || permission?.permission_action === TRANSCRIPT_PERMISSION
    ));
  }

  function activeTranscriptAssignment(profileId) {
    return (latestRbac?.assignments || []).find((assignment) => (
      assignment.profileId === profileId
      && assignment.roleSlug === TRANSCRIPT_ROLE
      && assignment.scopeType === "campaign"
      && assignment.scopeId === "yuhara-main"
      && assignment.status === "active"
      && !assignment.endsAt
    ));
  }

  function schedulePermissionPatch() {
    window.clearTimeout(permissionPatchTimer);
    permissionPatchTimer = window.setTimeout(patchPermissionUi, 0);
  }

  function ensurePermissionGridStyle() {
    if (document.querySelector("#transcriptPermissionStyle")) return;
    const style = document.createElement("style");
    style.id = "transcriptPermissionStyle";
    style.textContent = ".permission-toggles{grid-template-columns:repeat(auto-fit,minmax(155px,1fr))!important}.permission-toggle[hidden]{display:none!important}";
    document.head.appendChild(style);
  }

  async function refreshRbac() {
    const response = await fetch("/api/rbac?campaignSlug=yuhara-main", {
      headers: { Authorization: lastAuthorization },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Erro HTTP ${response.status}`);
    latestRbac = payload;
  }

  async function changeTranscriptPermission(input) {
    const profileId = input.dataset.profileId;
    const enabled = input.checked;
    if (!profileId || !lastAuthorization) {
      input.checked = !enabled;
      window.alert("Não foi possível validar sua sessão para alterar esta permissão.");
      return;
    }
    input.disabled = true;
    input.dataset.busy = "1";
    try {
      const response = await fetch("/api/transcript-permission", {
        method: "POST",
        headers: {
          Authorization: lastAuthorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaignSlug: "yuhara-main",
          profileId,
          enabled,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Erro HTTP ${response.status}`);
      await refreshRbac();
    } catch (error) {
      input.checked = !enabled;
      window.alert(error.message || String(error));
    } finally {
      input.disabled = false;
      delete input.dataset.busy;
      schedulePermissionPatch();
    }
  }

  function patchPermissionUi() {
    if (!isEditPath()) return;
    ensurePermissionGridStyle();

    document.querySelectorAll('.permission-toggle input[data-role-slug="site_editor"]').forEach((input) => {
      const description = input.closest(".permission-toggle")?.querySelector("small");
      if (description && description.textContent !== "Altera sessões e resumos publicados.") {
        description.textContent = "Altera sessões e resumos publicados.";
      }
    });

    if (latestRbac) {
      document.querySelectorAll("#permissionsList .permission-card").forEach((card) => {
        const firstInput = card.querySelector(".permission-toggle input[data-profile-id]");
        const profileId = firstInput?.dataset.profileId;
        const toggles = card.querySelector(".permission-toggles");
        if (!profileId || !toggles) return;

        let input = toggles.querySelector(`input[data-role-slug="${TRANSCRIPT_ROLE}"]`);
        if (!input) {
          const label = document.createElement("label");
          label.className = "permission-toggle";
          label.innerHTML = `<input type="checkbox" data-profile-id="${profileId}" data-role-slug="${TRANSCRIPT_ROLE}" /><span>Ver transcrições</span><small>Lê as transcrições completas das sessões.</small>`;
          toggles.appendChild(label);
          input = label.querySelector("input");
          input.addEventListener("change", () => changeTranscriptPermission(input));
        }
        if (!input.dataset.busy) input.checked = Boolean(activeTranscriptAssignment(profileId));
      });
    }

    document.querySelectorAll('[data-cloud-action="transcript"]').forEach((button) => {
      const denied = transcriptAllowed === false;
      button.hidden = denied;
      button.disabled = denied;
      if (denied) button.setAttribute("aria-hidden", "true");
      else button.removeAttribute("aria-hidden");
    });
  }

  function jsonResponse(response, payload) {
    const headers = new Headers(response.headers);
    headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(payload), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  function installPermissionFetchBridge() {
    if (!isEditPath()) return;
    window.fetch = async (input, options) => {
      const url = requestUrl(input);
      const headers = requestHeaders(input, options);
      const authorization = headers.get("Authorization");
      if (authorization) lastAuthorization = authorization;

      const response = await nativeFetch(input, options);
      if (!url) return response;

      if (url.pathname === "/api/auth/me" && response.ok) {
        const payload = await response.clone().json().catch(() => null);
        if (payload) {
          transcriptAllowed = hasTranscriptPermission(payload);
          payload.capabilities = {
            ...(payload.capabilities || {}),
            canReadTranscript: transcriptAllowed,
          };
          schedulePermissionPatch();
          return jsonResponse(response, payload);
        }
      }

      if ((url.pathname === "/api/rbac" || url.pathname.startsWith("/api/rbac/")) && response.ok) {
        response.clone().json().then((payload) => {
          latestRbac = payload?.rbac || payload || latestRbac;
          schedulePermissionPatch();
        }).catch(() => {});
      }
      return response;
    };
  }

  function storedTheme() {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      return validThemes.has(value) ? value : "";
    } catch (_error) {
      return "";
    }
  }

  function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function updateButtons() {
    const selected = root.dataset.theme || "";
    const effective = selected || systemTheme();
    const localized = effective === "light" ? "claro" : "escuro";
    const label = selected
      ? `Tema ${localized}. Alterar tema`
      : `Tema do sistema (${localized}). Alterar tema`;
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
      const text = button.querySelector("[data-theme-label]");
      if (text) text.textContent = selected ? localized : "sistema";
      const icon = button.querySelector("[data-theme-icon]");
      if (icon) icon.textContent = effective === "light" ? "☀" : "☾";
    });
  }

  function apply(theme = "") {
    if (validThemes.has(theme)) root.dataset.theme = theme;
    else delete root.dataset.theme;
    root.style.colorScheme = theme || "light dark";
    updateButtons();
  }

  function cycle() {
    const current = root.dataset.theme || "";
    const next = current === "" ? "light" : current === "light" ? "dark" : "";
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, next);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch (_error) {
      // Theme still works for the current page when storage is unavailable.
    }
    apply(next);
  }

  if (normalizeEditOrigin()) return;
  installPermissionFetchBridge();
  prepareEditSsrAuthBridge();
  apply(storedTheme());
  window.addEventListener("DOMContentLoaded", () => {
    updateButtons();
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", cycle);
    });
    const observer = new MutationObserver(schedulePermissionPatch);
    observer.observe(document.body, { childList: true, subtree: true });
    schedulePermissionPatch();
  });
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (!root.dataset.theme) updateButtons();
  });
})();
