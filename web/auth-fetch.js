(function () {
  const baseFetch = window.fetch.bind(window);

  function isSameOriginApi(input) {
    const rawUrl = typeof input === 'string' ? input : input?.url;
    if (!rawUrl) return false;
    try {
      const url = new URL(rawUrl, window.location.origin);
      return url.origin === window.location.origin && url.pathname.startsWith('/api/');
    } catch (_error) {
      return false;
    }
  }

  async function accessToken() {
    const client = window.state?.auth?.client;
    if (!client) return '';
    const { data, error } = await client.auth.getSession();
    if (error) return '';
    return data?.session?.access_token || '';
  }

  window.fetch = async function dndFetch(input, init = {}) {
    if (!isSameOriginApi(input)) return baseFetch(input, init);

    const token = await accessToken();
    if (!token) return baseFetch(input, init);

    const headers = new Headers(
      init.headers || (input instanceof Request ? input.headers : undefined)
    );
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

    return baseFetch(input, { ...init, headers });
  };
})();
