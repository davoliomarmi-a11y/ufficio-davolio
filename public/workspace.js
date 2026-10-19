import { openTabs } from './open-tabs.js';
import { formatDate } from './open-tabs-data.js';

const button = document.getElementById('read-workspace');
const status = document.getElementById('workspace-status');
button.onclick = () => { openTabs.read().catch(() => {}); };
openTabs.subscribe(state => {
  button.disabled = state.reading;
  button.textContent = state.reading ? 'Lettura in corso…' : 'Leggi posta e lavori';
  if (state.reading) { status.textContent = 'Un momento: sto leggendo gli elenchi nelle schede aperte.'; return; }
  if (state.error) { status.textContent = 'Lettura non riuscita. Controllate le indicazioni nei pannelli qui sotto.'; return; }
  if (!state.snapshot) return;
  const { mail, orders, readAt } = state.snapshot;
  const results = [];
  if (mail.status === 'ok') results.push(`${mail.items.length} messaggi visibili`);
  if (orders.status === 'ok') results.push(`${orders.items.length} lavori completati visibili`);
  const missing = mail.status !== 'ok' || orders.status !== 'ok';
  status.textContent = results.length
    ? `Letti ${results.join(' e ')} il ${formatDate(readAt)}. ${missing ? 'Una delle pagine non è stata letta: trovate le indicazioni qui sotto.' : 'Le liste possono essere parziali. Per le priorità della giornata, aprite il briefing.'}`
    : 'Nessuna pagina letta. Controllate le indicazioni nei pannelli qui sotto.';
});
