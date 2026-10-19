import { openTabs } from './open-tabs.js';
import { formatDate } from './open-tabs-data.js';

const el = id => document.getElementById(id);
let orders = [], checkedAt = null, failed = false, openedFromLink = false;
const completedDate = order => order.completedText || formatDate(order.completedAt);

function detail(order) {
  el('order-dialog-title').textContent = `Ordine n. ${order.number} · ${order.customer || 'Cliente non visibile'}`;
  el('order-content').replaceChildren();
  for (const value of [`Completato: ${completedDate(order)}`, `Categoria: ${order.category || 'Non visibile'}`, `Riferimento gestionale: ${order.reference || 'Non visibile'}`, order.description, `Materiale: ${order.material || 'Non visibile'}`, 'Fattura: da verificare in Fatture in Cloud.']) {
    if (!value) continue;
    const p = document.createElement('p');
    p.textContent = value;
    el('order-content').append(p);
  }
  el('order-dialog').showModal();
}

function render() {
  const query = el('completed-search').value.trim().toLocaleLowerCase('it');
  const shown = orders.filter(order => `${order.number} ${order.customer} ${order.reference}`.toLocaleLowerCase('it').includes(query));
  el('completed-count').textContent = checkedAt ? String(orders.length) : '—';
  el('completed-filter').textContent = checkedAt ? `${shown.length} lavori mostrati su ${orders.length} completati letti nella pagina aperta${query ? ' · Filtro: ' + el('completed-search').value.trim() : ''}. La lista può essere parziale.` : '';
  el('completed-rows').replaceChildren();
  for (const order of shown) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    const button = document.createElement('button');
    button.className = 'text-button';
    button.textContent = `N. ${order.number} · ${order.customer || 'Cliente non visibile'}`;
    button.onclick = () => detail(order);
    cell.append(button);
    row.append(cell);
    for (const value of [completedDate(order), `${order.category}${order.reference ? ' · Rif. ' + order.reference : ''}\n${order.description}`, 'Da verificare\nN. fattura: __________________']) {
      const td = document.createElement('td');
      td.textContent = value;
      row.append(td);
    }
    el('completed-rows').append(row);
  }
  el('completed-empty').hidden = !checkedAt || shown.length > 0;
  el('completed-empty').textContent = query ? 'Nessun lavoro letto corrisponde alla ricerca.' : 'Nessun lavoro completato tra le righe visibili lette. La lista del laboratorio può avere altre pagine o filtri.';
  el('print-completed').disabled = !checkedAt || !shown.length;
}

function unavailable(message) {
  failed = true;
  el('completed-status').className = 'invoice-warning';
  el('completed-status').textContent = `${message} ${checkedAt ? 'Resta la lettura precedente del ' + formatDate(checkedAt) + ', non aggiornata.' : 'Nessuna lista letta.'}`;
}

let lastSnapshot = null;
openTabs.subscribe(state => {
  el('refresh-completed').disabled = state.reading;
  el('completed-section').setAttribute('aria-busy', String(state.reading));
  if (state.reading) { el('completed-status').textContent = 'Lettura delle righe visibili nelle schede aperte…'; return; }
  if (state.error) { unavailable(state.error); return; }
  if (!state.snapshot || state.snapshot === lastSnapshot) return;
  lastSnapshot = state.snapshot;
  const data = state.snapshot.orders;
  if (data.status !== 'ok') { unavailable(data.message || 'Aprite nel laboratorio la lista dei lavori con numero, cliente e stato visibili.'); return; }
  orders = data.items;
  checkedAt = state.snapshot.readAt;
  failed = false;
  el('completed-status').className = 'live-status';
  el('completed-status').textContent = `Letto dalla scheda Lavori il ${formatDate(checkedAt)}. Solo righe visibili, non l’intero gestionale. ${data.message}`;
  render();
  if (!openedFromLink) {
    openedFromLink = true;
    const number = new URLSearchParams(location.search).get('ordine');
    const order = orders.find(item => String(item.number) === number);
    if (order) detail(order);
  }
});

el('refresh-completed').onclick = () => { openTabs.read().catch(() => {}); };
el('completed-search').oninput = render;
el('print-completed').onclick = () => {
  if (!checkedAt) return;
  el('printed-at').textContent = `D’Avolio Marmi · Stampato il ${formatDate(new Date().toISOString())} · Righe visibili lette il ${formatDate(checkedAt)} · Lista parziale${failed ? ' · ATTENZIONE: ultima lettura non riuscita; dati precedenti.' : ''}`;
  window.print();
};
