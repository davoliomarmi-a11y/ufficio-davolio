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

test('workspace starts with no fabricated reading and offers briefing and voice links', async t => {
  const page = await workspace(t);
  assert.equal(page.posted.length, 0);
  assert.equal(page.document.getElementById('mail-count').textContent, '—');
  assert.match(page.document.getElementById('mail-status').textContent, /Nessuna mail letta/);
  assert.equal(page.document.getElementById('print-completed').disabled, true);
  assert.ok([...page.document.querySelectorAll('a')].some(link => link.textContent.includes('Briefing programmati') && link.href === 'https://chatgpt.com/tasks'));
  assert.ok([...page.document.querySelectorAll('a')].some(link => link.textContent.includes('Assistente e voce')));
  page.window.close();
});

test('GitHub Pages subdirectory keeps assets and extension download on the published site', async t => {
  const page = await workspace(t, 'https://davoliomarmi-a11y.github.io/ufficio-davolio/?ordine=1151');
  const prefix = 'https://davoliomarmi-a11y.github.io/ufficio-davolio/';
  assert.equal(page.document.querySelector('link[rel="stylesheet"]').href, prefix + 'styles.css');
  assert.equal(page.document.querySelector('.brand img').src, prefix + 'logo-davolio.png');
  assert.equal(page.document.querySelector('a[download]').href, prefix + 'estensione-ufficio.zip');
  assert.equal(page.document.querySelector('#saved-report'), null);
  assert.doesNotMatch(page.document.body.textContent, /Carla Italia Monti|Luigi Risso|Lucia Montefusco/);
  page.read(fixture());
  assert.equal(page.document.getElementById('mail-count').textContent, '1');
  page.window.close();
});

test('one click updates both visible lists, escapes mail content, and preserves order filtering', async t => {
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
