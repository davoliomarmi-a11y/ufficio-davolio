import { openTabs } from './open-tabs.js';
import { formatDate } from './open-tabs-data.js';

const el = id => document.getElementById(id);
let messages = [], checkedAt = null, lastSnapshot = null;

function render() {
  el('mail-items').replaceChildren();
  for (const message of messages) {
    const item = document.createElement('article');
    item.className = 'mail-item';
    const heading = document.createElement('h3');
    heading.textContent = message.subject || 'Oggetto non visibile';
    const meta = document.createElement('p');
    meta.className = 'mail-meta';
    meta.textContent = `${message.sender || 'Mittente non visibile'}${message.dateText ? ' · ' + message.dateText : ''}${message.unread ? ' · Non letta nella scheda' : ''}`;
    item.append(heading, meta);
    if (message.snippet) { const snippet = document.createElement('p'); snippet.textContent = message.snippet; item.append(snippet); }
    if (message.url) {
      const link = document.createElement('a');
      link.href = message.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = message.urlType === 'message' ? 'Apri nella posta ↗' : 'Apri l’elenco Gmail ↗';
      item.append(link);
    }
    el('mail-items').append(item);
  }
  el('mail-empty').hidden = !checkedAt || messages.length > 0;
  el('mail-count').textContent = checkedAt ? String(messages.length) : '—';
}

function unavailable(message) {
  el('mail-state').textContent = checkedAt ? 'Dati precedenti' : 'Lettura non eseguita';
  el('mail-status').className = 'invoice-warning';
  el('mail-status').textContent = `${message} ${checkedAt ? 'Restano i messaggi letti il ' + formatDate(checkedAt) + ', non aggiornati.' : 'Nessuna mail letta da questa pagina.'}`;
}

openTabs.subscribe(state => {
  el('refresh-mail').disabled = state.reading;
  el('mail-section').setAttribute('aria-busy', String(state.reading));
  if (state.reading) { el('mail-state').textContent = 'Lettura in corso'; el('mail-status').textContent = 'Lettura dei messaggi già visibili nella scheda Gmail…'; return; }
  if (state.error) { unavailable(state.error); return; }
  if (!state.snapshot || state.snapshot === lastSnapshot) return;
  lastSnapshot = state.snapshot;
  const data = state.snapshot.mail;
  if (data.status !== 'ok') { unavailable(data.message || 'Aprite l’elenco dei messaggi nell’account Gmail dell’ufficio.'); return; }
  messages = data.items;
  checkedAt = state.snapshot.readAt;
  el('mail-state').textContent = 'Letto dalla scheda';
  el('mail-status').className = 'live-status';
  el('mail-status').textContent = `Letto il ${formatDate(checkedAt)} · ${data.accountEmail} · Solo messaggi visibili. ${data.message}`;
  el('mail-context').textContent = data.sourceTitle ? `Pagina letta: ${data.sourceTitle}` : 'Sono mostrati i messaggi della cartella o ricerca aperta in Gmail.';
  render();
});

el('refresh-mail').onclick = () => { openTabs.read().catch(() => {}); };
