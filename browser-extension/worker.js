'use strict';
const OFFICE_PATHS = new Map([
  ['https://ufficio-davolio.boldox64.chatgpt.site', '/'],
  ['https://davoliomarmi-a11y.github.io', '/ufficio-davolio/'],
  ['http://127.0.0.1:5173', '/'],
  ['http://127.0.0.1:8787', '/'],
]);
const SOURCE_ORIGINS = {
  mail: 'https://mail.google.com',
  orders: 'https://laboratorio-davolio.roberto81.chatgpt.site',
};
const missing = (message) => ({ status: 'unavailable', items: [], message });
function isOffice(sender) {
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !sender.tab || !sender.url) return false;
  try {
    const frame = new URL(sender.url);
    const tab = new URL(sender.tab.url);
    const path = OFFICE_PATHS.get(frame.origin);
    return path !== undefined && frame.pathname === path
      && frame.origin === tab.origin && tab.pathname === path;
  } catch { return false; }
}
function queryTabs(url) {
  return new Promise((resolve) => chrome.tabs.query({ url }, (tabs) => {
    const error = chrome.runtime.lastError;
    resolve(error ? [] : (tabs || []));
  }));
}
function readTab(tab, kind) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => { if (!done) { done = true; clearTimeout(timer); resolve(value); } };
    const timer = setTimeout(() => finish(missing('La scheda non risponde. Ricaricala e riprova.')), 4500);
    try {
      chrome.tabs.sendMessage(tab.id, { type: 'DAVOLIO_READ_VISIBLE_DOCUMENT', kind }, { frameId: 0 }, (result) => {
        const error = chrome.runtime.lastError;
        if (error || !result || !['ok', 'unavailable', 'unrecognized'].includes(result.status) || !Array.isArray(result.items)) {
          finish(missing('Ricarica la scheda già aperta per attivare l’estensione, poi riprova.'));
          return;
        }
        // Content scripts run in an isolated world; nevertheless restrict their source URL.
        try {
          if (result.sourceUrl && new URL(result.sourceUrl).origin !== SOURCE_ORIGINS[kind]) {
            finish(missing('La scheda è cambiata durante la lettura. Riprova.'));
            return;
          }
        } catch { finish(missing('Indirizzo della scheda non riconosciuto.')); return; }
        finish(result);
      });
    } catch { finish(missing('Impossibile leggere la scheda. Ricaricala e riprova.')); }
  });
}
async function collect(kind) {
  const label = kind === 'mail' ? 'Gmail con davoliomarmi@gmail.com nell’elenco dei messaggi' : 'il laboratorio nell’elenco degli ordini';
  const tabs = (await queryTabs(`${SOURCE_ORIGINS[kind]}/*`))
    .filter((tab) => typeof tab.id === 'number' && tab.url && (() => {
      try { return new URL(tab.url).origin === SOURCE_ORIGINS[kind]; } catch { return false; }
    })())
    .sort((a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active)) || (b.lastAccessed || 0) - (a.lastAccessed || 0));
  if (!tabs.length) return missing(`Apri ${label} in una scheda di questo profilo Chrome, poi riprova.`);
  // Read existing documents only. No tab navigation, activation, insertion, or scrolling.
  const results = await Promise.all(tabs.slice(0, 12).map((tab) => readTab(tab, kind)));
  return results.find((result) => result.status === 'ok')
    || results.find((result) => result.status === 'unrecognized')
    || results[0];
}
let activeRead = null;
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'DAVOLIO_READ_OPEN_TABS' || !isOffice(sender)) return;
  if (!activeRead) {
    activeRead = Promise.all([collect('mail'), collect('orders')])
      .then(([mail, orders]) => ({ readAt: new Date().toISOString(), mail, orders }))
      .catch(() => ({ readAt: new Date().toISOString(), mail: missing('Lettura non riuscita. Riprova.'), orders: missing('Lettura non riuscita. Riprova.') }))
      .finally(() => { activeRead = null; });
  }
  activeRead.then(respond);
  return true;
});
