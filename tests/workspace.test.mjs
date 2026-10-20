import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const external = createRequire(`${process.env.DAVOLIO_TEST_DEPS || '/tmp/davolio-extension-tests'}/package.json`);
const { JSDOM } = external('jsdom');

async function workspace(t, url = 'http://127.0.0.1:5173/') {
  const html = await readFile(new URL('../app/office.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const posted = [], timers = new Map();
  let nextTimer = 0;
  const { window } = dom;
  // JSDOM has no native modal dialogs; emulate the browser methods explicitly.
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  window.postMessage = (message, origin) => posted.push({ message, origin });
  window.setTimeout = callback => { const id = ++nextTimer; timers.set(id, callback); return id; };
  window.clearTimeout = id => timers.delete(id);
  window.fetch = () => { throw new Error('The workspace must not fetch an external or local data API.'); };
  window.eval(await readFile(new URL('../public/app.js', import.meta.url), 'utf8'));
  const context = dom.getInternalVMContext();
  const modules = new Map();
  async function load(name) {
    if (modules.has(name)) return modules.get(name);
    const entry = new vm.SourceTextModule(await readFile(new URL(`../public/${name}`, import.meta.url), 'utf8'), { context, identifier: name });
    modules.set(name, entry);
    await entry.link(specifier => load(specifier.replace(/^\.\//, '')));
    return entry;
  }
  for (const name of ['completed.js', 'mail.js', 'workspace.js']) await (await load(name)).evaluate();
  return {
    window, document: window.document, posted, timers,
    read(payload) {
      window.document.getElementById('local-reading').open = true;
      window.document.getElementById('read-workspace').click();
      const request = posted.at(-1);
      assert.equal(request.origin, window.location.origin);
      window.dispatchEvent(new window.MessageEvent('message', { source: window, origin: window.location.origin, data: { type: 'DAVOLIO_OPEN_TABS_RESULT', requestId: request.message.requestId, payload } }));
    },
  };
}

function fixture() {
  return {
    readAt: new Date().toISOString(),
    mail: { status: 'ok', accountEmail: 'davoliomarmi@gmail.com', sourceTitle: 'Ricerca to:info@davoliomarmi.com', items: [{ sender: 'Cliente di prova', subject: '<img src=x onerror=alert(1)>', snippet: 'Solo anteprima di prova', dateText: '10:00', url: 'javascript:alert(1)' }] },
    orders: { status: 'ok', items: [{ number: 1151, customer: 'Cliente di prova', category: 'Lapide', completedText: '19/10/2026 10:00' }] },
  };
}

test('landing page provides named direct activities and office tools without JavaScript', async t => {
  const html = await readFile(new URL('../app/office.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://davoliomarmi-a11y.github.io/ufficio-davolio/', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const document = dom.window.document;
  const expectedActivities = {
    first: ['Buongiorno ufficio', '6ad37ff090f88191a7d5e3232a583459'],
    second: ['Smistamento mail', '6ad24306d56c81919b1717c7b602bcdf'],
  };
  for (const [key, [title, id]] of Object.entries(expectedActivities)) {
    const link = document.querySelector(`a[data-activity="${key}"]`);
    assert.ok(link, `Missing direct activity: ${key}`);
    assert.ok(link.textContent.includes(title));
    assert.equal(link.href, `https://chatgpt.com/scheduled?automationId=${id}&automationSource=cloud`);
    assert.equal(link.closest('#local-reading'), null);
  }
  const tools = Object.fromEntries([...document.querySelectorAll('a[data-tool]')].map(link => [link.dataset.tool, link]));
  assert.deepEqual(Object.keys(tools).sort(), ['assistant', 'calendar', 'invoices', 'laboratory', 'mail']);
  const mail = new URL(tools.mail.href);
  assert.equal(mail.origin, 'https://mail.google.com');
  assert.equal(mail.searchParams.get('authuser'), 'davoliomarmi@gmail.com');
  assert.match(decodeURIComponent(mail.hash), /to:info@davoliomarmi\.com/);
  assert.equal(tools.calendar.href, 'https://calendar.google.com/calendar/r/day?authuser=davoliomarmi%40gmail.com');
  assert.equal(tools.laboratory.href, 'https://laboratorio-davolio.roberto81.chatgpt.site/');
  assert.equal(tools.invoices.href, 'https://secure.fattureincloud.it/');
  assert.equal(tools.assistant.href, 'https://chatgpt.com/c/6ad330e7-4018-83ed-8d60-b1390e1636af');
  const unread = new URL(document.querySelector('a[data-shortcut="unread"]').href);
  assert.equal(unread.searchParams.get('authuser'), 'davoliomarmi@gmail.com');
  assert.match(decodeURIComponent(unread.hash), /is:unread/);
  for (const link of document.querySelectorAll('a[data-activity], a[data-tool]')) {
    assert.equal(link.closest('#local-reading'), null);
    assert.equal(link.getAttribute('onclick'), null);
    assert.ok(link.target);
    assert.ok(link.relList.contains('noopener'));
  }
  const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
  assert.equal(new Set(ids).size, ids.length, 'IDs must be unique');
  assert.equal(document.querySelector('a a'), null);
  assert.equal(document.getElementById('local-reading').open, false);
});

test('local reading is optional and no mailbox activity occurs on landing', async t => {
  const page = await workspace(t);
  assert.equal(page.posted.length, 0);
  assert.equal(page.document.getElementById('local-reading').open, false);
  assert.equal(page.document.getElementById('mail-count').textContent, '—');
  assert.equal(page.document.getElementById('print-completed').disabled, true);
  assert.ok(page.document.querySelector('a[href="https://chatgpt.com/tasks"]'));
  assert.ok(page.document.querySelector('a[data-tool="assistant"]'));
});

test('help and large text controls work without interrupting direct office links', async t => {
  const page = await workspace(t);
  const dialog = page.document.getElementById('settings');
  page.document.getElementById('open-settings').click();
  assert.equal(dialog.open, true);
  const large = page.document.getElementById('large-text');
  large.click();
  assert.equal(page.document.documentElement.classList.contains('large'), true);
  assert.equal(large.getAttribute('aria-pressed'), 'true');
  large.click();
  assert.equal(page.document.documentElement.classList.contains('large'), false);
  assert.equal(large.getAttribute('aria-pressed'), 'false');
  dialog.querySelector('[data-close="settings"]').click();
  assert.equal(dialog.open, false);
  assert.ok(page.document.querySelector('a[data-tool="mail"]').href.startsWith('https://mail.google.com/'));
});

test('GitHub Pages subdirectory keeps assets and extension download on the published site', async t => {
  const page = await workspace(t, 'https://davoliomarmi-a11y.github.io/ufficio-davolio/?ordine=1151');
  const prefix = 'https://davoliomarmi-a11y.github.io/ufficio-davolio/';
  assert.equal(new URL(page.document.querySelector('link[rel="stylesheet"]').href).pathname, new URL(prefix + 'styles.css').pathname);
  assert.equal(new URL(page.document.querySelector('img[src^="logo-davolio.png"]').src).pathname, new URL(prefix + 'logo-davolio.png').pathname);
  assert.equal(new URL(page.document.querySelector('a[href^="estensione-ufficio.zip"][download]').href).pathname, new URL(prefix + 'estensione-ufficio.zip').pathname);
  assert.equal(page.document.querySelector('#saved-report'), null);
  assert.doesNotMatch(page.document.body.textContent, /Carla Italia Monti|Luigi Risso|Lucia Montefusco/);
  page.read(fixture());
  assert.equal(page.document.getElementById('mail-count').textContent, '1');
  page.window.close();
});

test('optional reading updates both visible lists, escapes mail content, and preserves order filtering', async t => {
  const page = await workspace(t);
  page.read(fixture());
  assert.equal(page.document.getElementById('mail-count').textContent, '1');
  assert.equal(page.document.getElementById('completed-count').textContent, '1');
  assert.match(page.document.getElementById('mail-items').textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(page.document.querySelector('#mail-items img'), null);
  assert.equal(page.document.querySelector('#mail-items a'), null);
  assert.match(page.document.getElementById('mail-context').textContent, /to:info@davoliomarmi.com/);
  assert.equal(page.document.getElementById('print-completed').disabled, false);
  const search = page.document.getElementById('completed-search');
  search.value = 'nessuna-corrispondenza';
  search.dispatchEvent(new page.window.Event('input'));
  assert.equal(page.document.querySelectorAll('#completed-rows tr').length, 0);
  assert.equal(page.document.getElementById('print-completed').disabled, true);
  assert.match(page.document.getElementById('workspace-status').textContent, /parziali/);
  page.window.close();
});

test('list printing enters order-only mode and restores the normal workspace afterwards', async t => {
  const page = await workspace(t);
  page.window.dispatchEvent(new page.window.Event('beforeprint'));
  assert.equal(page.document.body.classList.contains('print-orders'), false);
  page.read(fixture());
  let printCalls = 0;
  page.window.print = () => {
    printCalls += 1;
    assert.equal(page.document.body.classList.contains('print-orders'), true);
    assert.match(page.document.getElementById('printed-at').textContent, /Lista parziale/);
  };
  page.document.getElementById('print-completed').click();
  assert.equal(printCalls, 1);
  assert.equal(page.document.body.classList.contains('print-orders'), true);
  page.window.dispatchEvent(new page.window.Event('afterprint'));
  assert.equal(page.document.body.classList.contains('print-orders'), false);
  assert.equal(page.document.getElementById('completed-count').textContent, '1');
  assert.ok(page.document.querySelector('a[data-activity="first"]'));
});

test('a failed subsequent reading keeps previous data visibly marked as old', async t => {
  const page = await workspace(t);
  page.read(fixture());
  const fail = { readAt: new Date().toISOString(), mail: { status: 'unavailable', items: [], message: 'Gmail chiuso.' }, orders: { status: 'unrecognized', items: [], message: 'Tabella non riconosciuta.' } };
  page.read(fail);
  assert.equal(page.document.getElementById('mail-count').textContent, '1');
  assert.equal(page.document.getElementById('completed-count').textContent, '1');
  assert.equal(page.document.getElementById('mail-state').textContent, 'Dati precedenti');
  assert.match(page.document.getElementById('mail-status').textContent, /non aggiornati/);
  assert.match(page.document.getElementById('completed-status').textContent, /non aggiornata/);
  page.window.close();
});

test('mail can update while orders remain unreadable, and missing extension has a useful outcome', async t => {
  const page = await workspace(t);
  const payload = fixture();
  payload.orders.items[0].number = 'not-an-order';
  page.read(payload);
  assert.equal(page.document.getElementById('mail-count').textContent, '1');
  assert.equal(page.document.getElementById('completed-count').textContent, '—');
  page.document.getElementById('read-workspace').click();
  [...page.timers.values()][0]();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(page.document.getElementById('mail-status').textContent, /Estensione non disponibile/);
  assert.equal(page.document.getElementById('read-workspace').disabled, false);
  page.window.close();
});
