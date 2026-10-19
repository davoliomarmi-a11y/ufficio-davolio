/* This runs in Chrome's isolated content-script world, only on the office page. */
(() => {
  'use strict';
  const allowed = new Map([
    ['https://ufficio-davolio.boldox64.chatgpt.site', '/'],
    ['https://davoliomarmi-a11y.github.io', '/ufficio-davolio/'],
    ['http://127.0.0.1:5173', '/'],
    ['http://127.0.0.1:8787', '/'],
  ]);
  const isOfficePage = () => window.top === window && allowed.get(location.origin) === location.pathname;
  if (!isOfficePage()) return;
  let activeRequest = null;
  let lastRequest = 0;
  const unavailable = (message) => ({
    readAt: new Date().toISOString(),
    mail: { status: 'unavailable', items: [], message },
    orders: { status: 'unavailable', items: [], message },
  });
  function answer(requestId, payload) {
    if (!isOfficePage()) return;
    window.postMessage({ type: 'DAVOLIO_OPEN_TABS_RESULT', requestId, payload }, location.origin);
  }
  window.addEventListener('message', (event) => {
    if (!isOfficePage() || event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.type !== 'DAVOLIO_READ_OPEN_TABS' || typeof data.requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(data.requestId)) return;
    if (activeRequest || Date.now() - lastRequest < 1000) {
      answer(data.requestId, unavailable('Lettura già in corso. Attendi un momento e riprova.'));
      return;
    }
    const token = {};
    activeRequest = token;
    lastRequest = Date.now();
    const timer = setTimeout(() => {
      if (activeRequest !== token) return;
      activeRequest = null;
      answer(data.requestId, unavailable('Le schede non hanno risposto. Ricarica Gmail, il laboratorio e questa pagina, poi riprova.'));
    }, 10000);
    try {
      chrome.runtime.sendMessage({ type: 'DAVOLIO_READ_OPEN_TABS' }, (payload) => {
        const error = chrome.runtime.lastError;
        clearTimeout(timer);
        if (activeRequest !== token) return;
        activeRequest = null;
        answer(data.requestId, error || !payload
          ? unavailable('Estensione non disponibile o ricaricata. Ricarica Gmail, il laboratorio e questa pagina, poi riprova.')
          : payload);
      });
    } catch {
      clearTimeout(timer);
      if (activeRequest !== token) return;
      activeRequest = null;
      answer(data.requestId, unavailable('Estensione ricaricata. Ricarica Gmail, il laboratorio e questa pagina, poi riprova.'));
    }
  });
})();
