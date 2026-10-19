/* DOM readers are deliberately independent of Chrome APIs for local fixture tests. */
(() => {
  'use strict';
  const ACCOUNT = 'davoliomarmi@gmail.com';
  const MAIL_ORIGIN = 'https://mail.google.com';
  const LAB_ORIGIN = 'https://laboratorio-davolio.roberto81.chatgpt.site';
  const clean = (value, limit = 1200) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
  const text = (element, limit) => clean(element?.innerText ?? element?.textContent, limit);
  const normalized = (value) => clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function visible(element) {
    if (!element || element.closest('[hidden], [aria-hidden="true"]')) return false;
    const view = element.ownerDocument.defaultView;
    if (!view || !element.getClientRects().length) return false;
    let box = element.getBoundingClientRect();
    let left = Math.max(0, box.left), top = Math.max(0, box.top);
    let right = Math.min(view.innerWidth, box.right), bottom = Math.min(view.innerHeight, box.bottom);
    for (let current = element; current; current = current.parentElement) {
      const style = view.getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return false;
      if (current !== element && /(auto|scroll|hidden|clip)/.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`)) {
        box = current.getBoundingClientRect();
        left = Math.max(left, box.left); right = Math.min(right, box.right);
        top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom);
      }
    }
    return right > left && bottom > top;
  }
  function safeUrl(value, base, origin) {
    try {
      const url = new URL(value, base);
      return url.origin === origin && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }
  function digest(value) {
    let hash = 2166136261;
    for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return (hash >>> 0).toString(16);
  }
  function accountFromButton(document) {
    const found = new Set();
    for (const button of document.querySelectorAll('a[aria-label], button[aria-label], a[title]')) {
      if (!visible(button)) continue;
      const label = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''}`;
      let accountTarget = false;
      try {
        const href = new URL(button.getAttribute('href') || '', MAIL_ORIGIN);
        accountTarget = href.origin === 'https://accounts.google.com' && /^\/(?:SignOutOptions|AccountChooser)(?:[/?]|$)/.test(href.pathname);
      } catch { /* Not an account link. */ }
      if (!/(account google|google account|compte google|google-konto)/i.test(label) && !accountTarget) continue;
      const emails = [...new Set((label.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []).map((email) => email.toLowerCase()))];
      if (emails.length === 1) found.add(emails[0]);
    }
    return found.size === 1 ? [...found][0] : null;
  }
  function readMail(document, href) {
    const sourceUrl = safeUrl(href, MAIL_ORIGIN, MAIL_ORIGIN);
    const sourceTitle = text(document.querySelector('title'), 300) || 'Elenco Gmail aperto';
    const base = { sourceUrl, sourceTitle, items: [] };
    if (!sourceUrl) return { ...base, status: 'unrecognized', message: 'La scheda non è Gmail.' };
    const accountEmail = accountFromButton(document);
    if (!accountEmail) return { ...base, status: 'unrecognized', message: 'Account Gmail non verificabile. Apri Gmail con davoliomarmi@gmail.com: il pulsante account in alto a destra deve indicare questo indirizzo. Poi mostra l’elenco dei messaggi e riprova.' };
    if (accountEmail !== ACCOUNT) return { ...base, accountEmail, status: 'unrecognized', message: `La scheda Gmail appartiene a ${accountEmail}. Apri la casella davoliomarmi@gmail.com e riprova.` };
    base.accountEmail = accountEmail;
    const main = [...document.querySelectorAll('[role="main"], main')].find(visible);
    if (!main) return { ...base, status: 'unrecognized', message: 'Elenco Gmail non riconosciuto. Apri la posta in arrivo o una ricerca, chiudi il singolo messaggio e riprova.' };
    let rows = [...main.querySelectorAll('tr.zA')];
    if (!rows.length) rows = [...main.querySelectorAll('[role="row"]')].filter((row) => row.querySelector('.bog, .y6'));
    rows = rows.filter(visible);
    const items = [];
    const ids = new Set();
    for (const row of rows) {
      if (items.length >= 100) break;
      const subjectNode = row.querySelector('.bog') || row.querySelector('.y6 > span:not(.y2)') || row.querySelector('.y6:not(:has(.y2))');
      if (!subjectNode || !visible(subjectNode)) continue;
      const subject = text(subjectNode, 500);
      if (!subject) continue;
      const senders = [...row.querySelectorAll('.yW [email], .yW [name]')].filter(visible);
      const senderContainer = row.querySelector('.yW');
      const sender = clean(senders.map((node) => {
        const email = clean(node.getAttribute('email'), 320);
        const name = text(node, 200) || clean(node.getAttribute('name'), 200);
        return email && name && email !== name ? `${name} <${email}>` : email || name;
      }).filter(Boolean).join(', ') || (visible(senderContainer) ? text(senderContainer, 600) : ''), 600);
      const snippetNode = row.querySelector('.y2');
      const snippet = snippetNode && visible(snippetNode) ? text(snippetNode, 1200) : '';
      const dateNode = row.querySelector('.xW [title], .xW time, .xW, time');
      const dateText = dateNode && visible(dateNode) ? clean(dateNode.getAttribute('title') || dateNode.getAttribute('datetime') || text(dateNode), 150) : '';
      let url = null;
      for (const link of row.querySelectorAll('a[href]')) {
        if (!visible(link)) continue;
        const candidate = safeUrl(link.getAttribute('href'), sourceUrl, MAIL_ORIGIN);
        if (!candidate) continue;
        const parsed = new URL(candidate);
        // Keep only an actual DOM link to a conversation, never turn internal IDs into URLs.
        if (/^\/mail(?:\/|$)/.test(parsed.pathname) && /^#(?:inbox|all|sent|starred|important|spam|trash|label\/[^/]+|search\/[^/]+)\/.+/.test(parsed.hash)) { url = candidate; break; }
      }
      const internalId = row.getAttribute('data-legacy-thread-id') || row.getAttribute('data-thread-id') || '';
      const rawId = `visible-${digest(`${sourceUrl}|${internalId}|${sender}|${subject}|${dateText}|${snippet}`)}`;
      let id = rawId;
      for (let count = 2; ids.has(id); count += 1) id = `${rawId}-${count}`;
      ids.add(id);
      items.push({ id, sender, subject, snippet, dateText, url: url || sourceUrl, urlType: url ? 'message' : 'list', unread: row.classList.contains('zE') || /\b(non letto|unread)\b/i.test(row.getAttribute('aria-label') || '') });
    }
    if (items.length) return { ...base, status: 'ok', items, partial: true, message: `Letti ${items.length} messaggi visibili nella vista Gmail aperta. È una lettura parziale: nessuna ricerca, scorrimento o modifica ai messaggi.` };
    // Gmail's empty-list marker, not arbitrary message or conversation body text.
    const explicitEmpty = [...main.querySelectorAll('.ae4 .TD, table.F .TD, table[role="grid"] .TD')].some((node) => visible(node) && /^(?:nessuna conversazione|nessun messaggio|no conversations|no messages|no new mail|your inbox is empty|la tua casella di posta e vuota)\b/i.test(normalized(text(node, 600))));
    if (explicitEmpty && !rows.length) return { ...base, status: 'ok', emptyVerified: true, partial: true, message: 'Gmail mostra un elenco vuoto nella vista aperta. Questo non verifica l’intera casella.' };
    return { ...base, status: 'unrecognized', message: 'Nessuna riga Gmail visibile riconosciuta. Mostra l’elenco dei messaggi nella scheda, senza aprire una conversazione, e riprova.' };
  }
  function cells(row) {
    return [...row.children].filter((cell) => ['TD', 'TH'].includes(cell.tagName) || ['cell', 'gridcell', 'columnheader'].includes(cell.getAttribute('role')));
  }
  function column(headers, alternatives) { return headers.findIndex((header) => alternatives.some((pattern) => pattern.test(header))); }
  function readOrders(document, href) {
    const sourceUrl = safeUrl(href, LAB_ORIGIN, LAB_ORIGIN);
    const base = { sourceUrl, sourceTitle: text(document.querySelector('title'), 300) || 'Laboratorio', items: [] };
    if (!sourceUrl) return { ...base, status: 'unrecognized', message: 'La scheda non è il laboratorio Davolio.' };
    let recognized = false, visibleData = 0, explicitEmpty = false;
    const items = [];
    const seenRows = new Set();
    for (const table of document.querySelectorAll('table, [role="table"], [role="grid"]')) {
      if (!visible(table)) continue;
      const rows = [...table.querySelectorAll('tr, [role="row"]')].filter((row) => row.closest('table, [role="table"], [role="grid"]') === table);
      const header = rows.find((row) => row.querySelector('th, [role="columnheader"]')) || rows[0];
      if (!header) continue;
      const headers = cells(header).map((cell) => normalized(text(cell, 200)));
      const indexes = {
        status: column(headers, [/^stato$/, /^status$/]),
        number: column(headers, [/^(?:n[.°º]?|numero)(?:\s+(?:ordine|lavoro))?$/, /^ordine$/, /^n[.°º]?\s*ordine$/]),
        customer: column(headers, [/^cliente$/, /^committente$/]),
        category: column(headers, [/^categoria$/, /^tipo(?:logia)?(?:\s+lavoro)?$/]),
        reference: column(headers, [/^riferimento(?:\s+gestionale)?$/, /^rif\.?$/]),
        completed: column(headers, [/^completat[oa](?:\s+il)?$/, /^data\s+(?:di\s+)?completamento$/, /^terminat[oa](?:\s+il)?$/]),
        description: column(headers, [/^descrizione$/, /^lavorazione$/, /^lavoro$/]),
        material: column(headers, [/^materiale$/]),
        archived: column(headers, [/^archiviat[oa]$/, /^archivio$/]),
      };
      if (indexes.status < 0 || indexes.number < 0 || indexes.customer < 0) continue;
      recognized = true;
      for (const row of rows) {
        if (row === header || seenRows.has(row) || !visible(row)) continue;
        seenRows.add(row);
        const columns = cells(row);
        if (columns.length === 1 && visible(columns[0]) && Number(columns[0].getAttribute('colspan') || columns[0].getAttribute('aria-colspan')) >= headers.length && /^(?:nessun (?:ordine|lavoro|risultato)(?: trovato| presente| disponibile)?|no (?:orders|results)(?: found)?)[.!]?$/i.test(text(columns[0], 200))) {
          explicitEmpty = true;
          continue;
        }
        if (columns.length < Math.max(indexes.status, indexes.number, indexes.customer) + 1) continue;
        const value = (key) => indexes[key] >= 0 && visible(columns[indexes[key]]) ? text(columns[indexes[key]]) : '';
        const status = value('status'), number = value('number').replace(/^(?:#|n[.°º]?)\s*(\d+)$/i, '$1'), customer = value('customer');
        if (!status || !number || !customer) continue;
        visibleData += 1;
        if (!/^(completato|completata|completati)$/.test(normalized(status))) continue;
        if (/^(si|yes|true|archiviato|archiviata)$/.test(normalized(value('archived'))) || row.getAttribute('data-archived') === 'true') continue;
        if (items.length >= 500) continue;
        const completedText = value('completed');
        const time = indexes.completed >= 0 ? columns[indexes.completed]?.querySelector('time[datetime]') : null;
        const iso = time && visible(time) ? time.getAttribute('datetime') : null;
        const completedAt = iso && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(iso) && Number.isFinite(Date.parse(iso)) ? new Date(iso).toISOString() : null;
        const link = [...row.querySelectorAll('a[href]')].find((node) => visible(node) && safeUrl(node.getAttribute('href'), sourceUrl, LAB_ORIGIN));
        const url = link ? safeUrl(link.getAttribute('href'), sourceUrl, LAB_ORIGIN) : undefined;
        items.push({ number, customer, category: value('category'), reference: value('reference'), completedAt, completedText, description: value('description'), material: value('material'), ...(url ? { url } : {}) });
      }
    }
    if (recognized && (visibleData > 0 || explicitEmpty)) return { ...base, status: 'ok', items, emptyVerified: !items.length, partial: true, message: items.length ? `Letti ${items.length} ordini completati tra le righe visibili del laboratorio. La lista è parziale.` : 'Nessun ordine completato tra le righe visibili riconosciute. La lettura non verifica altri filtri o pagine del laboratorio.' };
    return { ...base, status: 'unrecognized', message: recognized ? 'La tabella è riconosciuta ma non mostra righe leggibili. Mostra gli ordini nella scheda e riprova.' : 'Tabella del laboratorio non riconosciuta. Servono le colonne Stato, Numero/Ordine e Cliente. Nessun ordine è stato dedotto da una pagina non riconosciuta.' };
  }
  globalThis.DavolioDomReader = Object.freeze({ readMail, readOrders, visible });
})();
