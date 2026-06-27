(function () {
  if (typeof window.toast === 'function') return;

  window.toast = function toast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = String(message || '');
    el.classList.remove('hidden');
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
  };
})();
