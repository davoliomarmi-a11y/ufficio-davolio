import { normalizeReading } from './open-tabs-data.js';

const listeners = new Set();
let current = { reading: false, snapshot: null, error: null };
let pending = null;

function notify(change) {
  current = { ...current, ...change };
  for (const listener of listeners) listener(current);
}

function fail(message) {
  if (!pending) return;
  const request = pending;
  pending = null;
  clearTimeout(request.timer);
  notify({ reading: false, error: message });
  request.reject(new Error(message));
}

window.addEventListener('message', event => {
  if (event.source !== window || event.origin !== location.origin || !pending) return;
  if (event.data?.type !== 'DAVOLIO_OPEN_TABS_RESULT' || event.data.requestId !== pending.id) return;
  try {
    const snapshot = normalizeReading(event.data.payload);
    const request = pending;
    pending = null;
    clearTimeout(request.timer);
    notify({ reading: false, snapshot, error: null });
    request.resolve(snapshot);
  } catch (error) { fail(error.message); }
});

export const openTabs = Object.freeze({
  subscribe(listener) {
    listeners.add(listener);
    listener(current);
    return () => listeners.delete(listener);
  },
  read() {
    if (pending) return pending.promise;
    const id = crypto.randomUUID();
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    pending = { id, promise, resolve, reject, timer: setTimeout(() => { fail('Estensione non disponibile o lettura scaduta. Installate l’estensione Ufficio, ricaricate questa pagina e tenete aperte le schede Posta e Lavori.'); }, 12000) };
    notify({ reading: true, error: null });
    window.postMessage({ type: 'DAVOLIO_READ_OPEN_TABS', requestId: id }, location.origin);
    return promise;
  },
});
