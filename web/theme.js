(() => {
  const STORAGE_KEY = "dnd-scribe-theme";
  const root = document.documentElement;
  const validThemes = new Set(["light", "dark"]);

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

  apply(storedTheme());
  window.addEventListener("DOMContentLoaded", () => {
    updateButtons();
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", cycle);
    });
  });
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (!root.dataset.theme) updateButtons();
  });
})();
