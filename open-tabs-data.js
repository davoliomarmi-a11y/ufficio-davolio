const MAIL_HOST = 'mail.google.com';
const LAB_HOST = 'laboratorio-davolio.roberto81.chatgpt.site';
const statuses = new Set(['ok', 'unavailable', 'unrecognized']);

export function text(value, limit = 600) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit) : '';
}

export function safeLink(value, host) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === host && !url.port && !url.username && !url.password && url.href.length <= 3000 ? url.href : null;
  } catch { return null; }
}

function collection(value, kind) {
  if (!value || !statuses.has(value.status)) throw new TypeError('Risposta delle schede non valida.');
  const result = { status: value.status, items: [], message: text(value.message, 1200), sourceUrl: safeLink(value.sourceUrl, kind === 'mail' ? MAIL_HOST : LAB_HOST), sourceTitle: text(value.sourceTitle, 200), accountEmail: text(value.accountEmail, 200) };
  if (value.status !== 'ok') return result;
  if (!Array.isArray(value.items) || value.items.length > (kind === 'mail' ? 100 : 500)) throw new TypeError('Elenco delle schede non valido.');
  if (!value.items.length && value.emptyVerified !== true) return { ...result, status: 'unrecognized', message: 'La pagina non conferma un elenco vuoto. Nessuna nuova lettura verificata.' };
  if (kind === 'mail') {
    if (typeof value.accountEmail !== 'string' || value.accountEmail.toLowerCase() !== 'davoliomarmi@gmail.com') return { ...result, status: 'unrecognized', message: 'Account Gmail non verificato: aprite la posta di davoliomarmi@gmail.com.' };
    result.items = value.items.map((item, index) => {
      if (!item || typeof item.subject !== 'string' || typeof item.sender !== 'string') throw new TypeError('Messaggio visibile non valido.');
      return { id: text(item.id, 200) || String(index), sender: text(item.sender, 300), subject: text(item.subject, 500), snippet: text(item.snippet, 1000), dateText: text(item.dateText, 150), unread: item.unread === true, url: safeLink(item.url, MAIL_HOST), urlType: item.urlType === 'message' ? 'message' : 'list' };
    });
  } else {
    result.items = value.items.map(item => {
      const number = Number(item?.number);
      if (!item || !Number.isSafeInteger(number) || number < 1) throw new TypeError('Numero del lavoro non valido.');
      return { number, customer: text(item.customer, 300), category: text(item.category, 300), reference: text(item.reference, 300), description: text(item.description, 1500), material: text(item.material, 300), completedAt: typeof item.completedAt === 'string' && Number.isFinite(Date.parse(item.completedAt)) ? item.completedAt : null, completedText: text(item.completedText, 150), url: safeLink(item.url, LAB_HOST) };
    });
  }
  return result;
}

export function normalizeReading(value, now = Date.now()) {
  if (!value || !Number.isFinite(Date.parse(value.readAt)) || Math.abs(Date.parse(value.readAt) - now) > 120000) throw new TypeError('Ora della lettura non valida. Riprovate dalle schede aperte.');
  const read = kind => {
    try { return collection(value[kind], kind); }
    catch (error) { return { status: 'unrecognized', items: [], message: error.message, sourceUrl: null, sourceTitle: '', accountEmail: '' }; }
  };
  return { readAt: value.readAt, mail: read('mail'), orders: read('orders') };
}

export function formatDate(value) {
  return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Rome' }).format(new Date(value)) : 'Non indicato';
}
