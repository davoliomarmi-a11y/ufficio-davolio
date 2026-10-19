'use strict';
(() => {
  const el = id => document.getElementById(id);
  let orders = [], checkedAt = null, busy = false, failed = false, openedFromLink = false;
  const date = value => value && !isNaN(Date.parse(value)) ? new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Rome'}).format(new Date(value)) : 'Non indicato';
  function detail(order) {
    el('order-dialog-title').textContent = `Ordine n. ${order.number} · ${order.customer}`;
    el('order-content').replaceChildren();
    for (const value of [`Completato: ${date(order.completedAt)}`,`Categoria: ${order.category}`,`Riferimento gestionale: ${order.reference || 'Non indicato'}`,order.description,`Materiale: ${order.material || 'Non indicato'}`,'Fattura: da verificare in Fatture in Cloud.']) {const p=document.createElement('p');p.textContent=value;el('order-content').append(p);}
    el('order-dialog').showModal();
  }
  function render() {
    const query = el('completed-search').value.trim().toLocaleLowerCase('it');
    const shown = orders.filter(o => `${o.number} ${o.customer} ${o.reference}`.toLocaleLowerCase('it').includes(query));
    el('completed-count').textContent = checkedAt ? String(orders.length) : '—';
    el('completed-filter').textContent = checkedAt ? `${shown.length} lavori visualizzati su ${orders.length}${query ? ' · Filtro: '+el('completed-search').value.trim() : ''}` : '';
    el('completed-rows').replaceChildren();
    for (const o of shown) {
      const tr=document.createElement('tr');
      const td=document.createElement('td'),link=document.createElement('a');
      link.href=`?ordine=${encodeURIComponent(o.number)}#completed-section`;link.textContent=`N. ${o.number} · ${o.customer}`;link.onclick=e=>{e.preventDefault();detail(o)};td.append(link);tr.append(td);
      for(const text of [date(o.completedAt),`${o.category}${o.reference ? ' · Rif. '+o.reference : ''}\n${o.description}`, 'Da verificare\nN. fattura: __________________']){const cell=document.createElement('td');cell.textContent=text;tr.append(cell);}
      el('completed-rows').append(tr);
    }
    el('completed-empty').hidden=!checkedAt || shown.length>0;
    el('completed-empty').textContent=query?'Nessun lavoro corrisponde alla ricerca.':'Nessun lavoro nello stato “Completato”.';
    el('print-completed').disabled=!checkedAt || !shown.length;
  }
  async function refresh() {
    if (busy) return;
    busy=true;el('refresh-completed').disabled=true;
    try {
      const r=await fetch('/api/completed-orders',{cache:'no-store',signal:AbortSignal.timeout(20000)});
      if(!r.ok) throw new Error(r.status===401?'Accesso richiesto: riaprite il sito e accedete con ChatGPT.':'Il laboratorio non risponde.');
      const data=await r.json();if(!Array.isArray(data.orders)||!data.checkedAt)throw new Error('Risposta del laboratorio non valida.');
      orders=data.orders;checkedAt=data.checkedAt;failed=false;
      el('completed-status').textContent=`Aggiornato dal laboratorio il ${date(checkedAt)} · aggiornamento automatico attivo`;
      el('completed-status').className='live-status';render();
      if(!openedFromLink){openedFromLink=true;const n=new URLSearchParams(location.search).get('ordine');if(n){const order=orders.find(o=>String(o.number)===n);if(order)detail(order);else {el('completed-status').textContent+=` · Ordine ${n} non presente tra i completati.`;}}}
    } catch(e) {
      failed=true;el('completed-status').className='invoice-warning';
      el('completed-status').textContent=`Aggiornamento non riuscito. ${e.message} ${checkedAt ? 'Dati non aggiornati: ultima lettura '+date(checkedAt)+'.' : 'Nessuna lista disponibile.'}`;
    } finally {busy=false;el('refresh-completed').disabled=false;}
  }
  el('refresh-completed').onclick=refresh;el('completed-search').oninput=render;
  el('print-completed').onclick=()=>{if(!checkedAt)return;el('printed-at').textContent=`D’Avolio Marmi · Stampato il ${date(new Date().toISOString())} · Dati letti il ${date(checkedAt)}${failed?' · ATTENZIONE: aggiornamento non riuscito, dati precedenti.':''}`;window.print();};
  refresh();setInterval(()=>{if(!document.hidden)refresh()},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});window.addEventListener('online',refresh);
})();
