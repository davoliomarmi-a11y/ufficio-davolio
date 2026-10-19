import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Test dependencies live outside the checkout; no package or lockfile is changed.
const external = createRequire(`${process.env.DAVOLIO_TEST_DEPS || '/tmp/davolio-extension-tests'}/package.json`);
const { JSDOM } = external('jsdom');
const readerCode = readFileSync(new URL('../dom-reader.js', import.meta.url), 'utf8');
const workerCode = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
const bridgeCode = readFileSync(new URL('../bridge.js', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const mailUrl = 'https://mail.google.com/mail/u/0/#inbox';
const labUrl = 'https://laboratorio-davolio.roberto81.chatgpt.site/';
function fixture(html, url) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  // JSDOM has no layout: only geometry is stubbed; selectors, ancestors and CSS are real.
  dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
    const left = this.closest('[data-offscreen]') ? 1500 : 10;
    return { x: left, y: 10, left, top: 10, right: left + 400, bottom: 200, width: 400, height: 190 };
  };
  dom.window.HTMLElement.prototype.getClientRects = function () { return [this.getBoundingClientRect()]; };
  dom.window.eval(readerCode);
  const reader = dom.window.DavolioDomReader;
  return { dom, mail: () => reader.readMail(dom.window.document, url), orders: () => reader.readOrders(dom.window.document, url) };
}
const account = (email = 'davoliomarmi@gmail.com') => `<a aria-label="Account Google: Davolio (${email})" href="https://accounts.google.com/SignOutOptions">Account</a>`;
const mailRow = (attributes = '', subject = 'Preventivo lapide') => `<tr class="zA zE" ${attributes}><td class="yW"><span email="cliente@example.com">Cliente</span></td><td class="y6"><span class="bog">${subject}</span><span class="y2">Testo visibile</span></td><td class="xW"><span title="19 ottobre 2026, 10:00">10:00</span></td></tr>`;
const gmail = (rows, extra = '') => `${account()}<title>Posta in arrivo - Gmail</title><main role="main"><table>${rows}</table>${extra}</main>`;
const table = (rows) => `<table><thead><tr><th>Stato</th><th>Ordine</th><th>Cliente</th><th>Materiale</th><th>Completato il</th></tr></thead><tbody>${rows}</tbody></table>`;
const order = (status, number = '#1151', attrs = '', statusAttrs = '') => `<tr ${attrs}><td ${statusAttrs}>${status}</td><td>${number}</td><td>Cliente Rossi</td><td>Marmo</td><td><time datetime="2026-10-19T10:00:00+02:00">19/10/2026 10:00</time></td></tr>`;

test('Gmail: verified active account, sender, subject, snippet, unread and truthful list fallback', () => {
  const result = fixture(gmail(mailRow()), mailUrl).mail();
  assert.equal(result.status, 'ok');
  assert.equal(result.accountEmail, 'davoliomarmi@gmail.com');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].subject, 'Preventivo lapide');
  assert.equal(result.items[0].sender, 'Cliente <cliente@example.com>');
  assert.equal(result.items[0].snippet, 'Testo visibile');
  assert.equal(result.items[0].unread, true);
  assert.equal(result.items[0].url, mailUrl);
  assert.equal(result.items[0].urlType, 'list');
  assert.equal(result.partial, true);
});
test('Gmail: a DOM conversation URL is retained and an external URL is not', () => {
  const safe = '<a href="#inbox/real-message-link">Apri</a>';
  const unsafe = '<a href="https://attacker.example/read">Apri</a>';
  const result = fixture(gmail(mailRow('', `Ordine ${unsafe}${safe}`)), mailUrl).mail();
  assert.equal(result.items[0].url, 'https://mail.google.com/mail/u/0/#inbox/real-message-link');
  assert.equal(result.items[0].urlType, 'message');
});
test('Gmail: internal data-thread-id is never converted into a fabricated deep link', () => {
  const result = fixture(gmail(mailRow('data-thread-id="thread-f:1234567890"')), mailUrl).mail();
  assert.equal(result.items[0].url, mailUrl);
  assert.equal(result.items[0].urlType, 'list');
});
test('Gmail: wrong or unverifiable account cannot return messages', () => {
  for (const html of [
    `${account('other@example.com')}<main role="main"><table>${mailRow()}</table></main>`,
    `<main role="main">davoliomarmi@gmail.com<table>${mailRow()}</table></main>`,
  ]) {
    const result = fixture(html, mailUrl).mail();
    assert.equal(result.status, 'unrecognized');
    assert.equal(result.items.length, 0);
  }
});
test('Gmail: repeated account address on the same account button remains verifiable', () => {
  const html = gmail(mailRow()).replace('href="https://accounts.google.com', 'title="davoliomarmi@gmail.com" href="https://accounts.google.com');
  assert.equal(fixture(html, mailUrl).mail().status, 'ok');
});
test('Gmail: offscreen sender cell cannot leak through its text fallback', () => {
  const html = gmail(mailRow().replace('class="yW"', 'class="yW" data-offscreen'));
  const result = fixture(html, mailUrl).mail();
  assert.equal(result.items[0].sender, '');
});
test('Gmail: hidden and outside-viewport messages are excluded', () => {
  const result = fixture(gmail(mailRow('', 'Visibile') + mailRow('style="display:none"', 'Nascosta') + mailRow('data-offscreen', 'Fuori vista')), mailUrl).mail();
  assert.deepEqual(Array.from(result.items, (item) => item.subject), ['Visibile']);
});
test('Gmail: conversation body saying no messages is not proof of an empty list', () => {
  const result = fixture(`${account()}<main role="main"><div class="a3s">Nessun messaggio</div></main>`, mailUrl).mail();
  assert.equal(result.status, 'unrecognized');
  assert.notEqual(result.emptyVerified, true);
});
test('Gmail: recognized empty-list marker permits an explicitly partial empty result', () => {
  const result = fixture(`${account()}<main role="main"><table class="F"><tr><td class="TD">No new mail!</td></tr></table></main>`, mailUrl).mail();
  assert.equal(result.status, 'ok');
  assert.equal(result.emptyVerified, true);
  assert.equal(result.partial, true);
});
test('Gmail: visible extraction is capped at 100 rows', () => {
  const result = fixture(gmail(Array.from({ length: 120 }, (_, i) => mailRow('', `Oggetto ${i}`)).join('')), mailUrl).mail();
  assert.equal(result.items.length, 100);
});
test('Laboratorio: only exact completed statuses are included, archived and negative statuses excluded', () => {
  const html = table(order('Completato') + order('Non completato', '1152') + order('Archiviato', '1153') + order('Completata', '1154') + order('Completati', '1155') + order('Completato', '1156', 'data-archived="true"'));
  const result = fixture(html, labUrl).orders();
  assert.equal(result.status, 'ok');
  assert.deepEqual(Array.from(result.items, (item) => item.number), ['1151', '1154', '1155']);
  assert.equal(result.items[0].completedAt, '2026-10-19T08:00:00.000Z');
});
test('Laboratorio: missing structure and generic empty text do not produce success', () => {
  for (const html of ['<main>Nessun ordine</main>', '<table><tr><td>Completato</td><td>1151</td></tr></table>', table('')]) {
    const result = fixture(html, labUrl).orders();
    assert.equal(result.status, 'unrecognized');
    assert.notEqual(result.emptyVerified, true);
  }
});
test('Laboratorio: visible row with offscreen status is not a verified empty list', () => {
  const result = fixture(table(order('Completato', '1151', '', 'data-offscreen')), labUrl).orders();
  assert.equal(result.status, 'unrecognized');
  assert.notEqual(result.emptyVerified, true);
});
test('Laboratorio: visible non-completed rows and exact empty marker verify only the visible subset', () => {
  for (const html of [table(order('In lavorazione')), table('<tr><td colspan="5">Nessun ordine trovato</td></tr>')]) {
    const result = fixture(html, labUrl).orders();
    assert.equal(result.status, 'ok');
    assert.equal(result.items.length, 0);
    assert.equal(result.emptyVerified, true);
    assert.equal(result.partial, true);
  }
});
const approvedOfficeUrls = [
  'https://davoliomarmi-a11y.github.io/ufficio-davolio/',
  'https://davoliomarmi-a11y.github.io/ufficio-davolio/?ordine=1151#posta',
  'https://ufficio-davolio.boldox64.chatgpt.site/?ordine=1151#posta',
  'http://127.0.0.1:5173/?ordine=1151#posta',
  'http://127.0.0.1:8787/',
];
const rejectedOfficeUrls = [
  'https://davoliomarmi-a11y.github.io/',
  'https://davoliomarmi-a11y.github.io/#/ufficio-davolio/',
  'https://davoliomarmi-a11y.github.io/?next=/ufficio-davolio/',
  'https://davoliomarmi-a11y.github.io/ufficio-davolio',
  'https://davoliomarmi-a11y.github.io/ufficio-davolio/other#/',
  'https://davoliomarmi-a11y.github.io/other/?ordine=1151#/ufficio-davolio/',
  'https://davoliomarmi-a11y.github.io.evil.example/ufficio-davolio/',
  'https://another-account.github.io/ufficio-davolio/',
  'http://davoliomarmi-a11y.github.io/ufficio-davolio/',
  'https://ufficio-davolio.boldox64.chatgpt.site/other#/',
  'http://127.0.0.1:3000/',
  'http://127.0.0.1:5173/ufficio-davolio/',
  'http://localhost:5173/',
];
test('Manifest: GitHub Pages is restricted to the office repository path and extension is version 1.1.0', () => {
  const githubMatch = 'https://davoliomarmi-a11y.github.io/ufficio-davolio/*';
  assert.equal(manifest.version, '1.1.0');
  assert.deepEqual(manifest.host_permissions.filter((entry) => entry.includes('github.io')), [githubMatch]);
  assert.deepEqual(manifest.content_scripts.flatMap((entry) => entry.matches).filter((entry) => entry.includes('github.io')), [githubMatch]);
});
test('Worker: foreign origins, paths, frames and extension IDs are rejected before querying tabs', () => {
  let listener, queries = 0;
  const chrome = { runtime: { id: 'own', onMessage: { addListener: (fn) => { listener = fn; } } }, tabs: { query: () => { queries += 1; } } };
  vm.runInNewContext(workerCode, { chrome, URL, setTimeout, clearTimeout, Date });
  const valid = { id: 'own', frameId: 0, url: 'https://ufficio-davolio.boldox64.chatgpt.site/', tab: { url: 'https://ufficio-davolio.boldox64.chatgpt.site/' } };
  for (const sender of [
    { ...valid, id: 'other' }, { ...valid, frameId: 1 },
    { ...valid, url: 'https://attacker.example/' },
    { ...valid, url: 'https://ufficio-davolio.boldox64.chatgpt.site/other' },
    { ...valid, url: 'http://127.0.0.1:3000/', tab: { url: 'http://127.0.0.1:3000/' } },
    { ...valid, tab: { url: 'https://attacker.example/' } },
    ...rejectedOfficeUrls.map((url) => ({ ...valid, url, tab: { url } })),
    { ...valid, url: approvedOfficeUrls[0], tab: { url: 'https://davoliomarmi-a11y.github.io/other/' } },
    { ...valid, url: approvedOfficeUrls[0], tab: { url: valid.url } },
  ]) assert.equal(listener({ type: 'DAVOLIO_READ_OPEN_TABS' }, sender, () => assert.fail('Unauthorized response')), undefined);
  assert.equal(queries, 0);
});
test('Worker: approved dashboard receives clear missing-tab results without network or storage', async () => {
  for (const url of approvedOfficeUrls) {
    let listener;
    const queries = [];
    const chrome = { runtime: { id: 'own', onMessage: { addListener: (fn) => { listener = fn; } } }, tabs: { query: (query, done) => { queries.push(query.url); done([]); } } };
    vm.runInNewContext(workerCode, { chrome, URL, setTimeout, clearTimeout, Date });
    const result = await new Promise((resolve) => {
      assert.equal(listener({ type: 'DAVOLIO_READ_OPEN_TABS' }, { id: 'own', frameId: 0, url, tab: { url } }, resolve), true, url);
    });
    assert.equal(result.mail.status, 'unavailable', url);
    assert.equal(result.orders.status, 'unavailable', url);
    assert.equal(queries.length, 2, url);
  }
});
function bridgeFixture(url, framed = false, beforeReply = () => {}) {
  const location = new URL(url);
  const listeners = [];
  const calls = [];
  const responses = [];
  const window = {
    addEventListener: (event, listener) => { if (event === 'message') listeners.push(listener); },
    postMessage: (message, origin) => { responses.push({ message, origin }); },
  };
  window.top = framed ? {} : window;
  const chrome = { runtime: { sendMessage: (message, done) => { calls.push(message); beforeReply(location); done({ readAt: 'test', mail: {}, orders: {} }); } } };
  vm.runInNewContext(bridgeCode, { window, location, chrome, setTimeout, clearTimeout, Date });
  const send = (overrides = {}) => {
    const event = { source: window, origin: location.origin, data: { type: 'DAVOLIO_READ_OPEN_TABS', requestId: 'request-1' }, ...overrides };
    for (const listener of listeners) listener(event);
  };
  return { window, location, listeners, calls, responses, send };
}
test('Bridge: approved exact paths retain order queries and fragments', () => {
  for (const url of approvedOfficeUrls) {
    const bridge = bridgeFixture(url);
    bridge.send();
    assert.equal(bridge.calls.length, 1, url);
    assert.equal(bridge.responses.length, 1, url);
    assert.equal(bridge.responses[0].origin, new URL(url).origin, url);
    assert.equal(bridge.responses[0].message.requestId, 'request-1', url);
  }
});
test('Bridge: other repository paths, fragment route bypasses, origins and frames cannot request data', () => {
  for (const url of rejectedOfficeUrls) {
    const bridge = bridgeFixture(url);
    bridge.send();
    assert.equal(bridge.listeners.length, 0, url);
    assert.equal(bridge.calls.length, 0, url);
  }
  const framed = bridgeFixture(approvedOfficeUrls[0], true);
  framed.send();
  assert.equal(framed.listeners.length, 0);
  assert.equal(framed.calls.length, 0);
  const bridge = bridgeFixture(approvedOfficeUrls[0]);
  bridge.send({ source: {} });
  bridge.send({ origin: 'https://attacker.example' });
  assert.equal(bridge.calls.length, 0);
});
test('Bridge: same-document navigation outside the approved path stops subsequent requests', () => {
  const bridge = bridgeFixture(approvedOfficeUrls[0]);
  bridge.location.pathname = '/other/';
  bridge.location.hash = '/ufficio-davolio/';
  bridge.send();
  assert.equal(bridge.calls.length, 0);
  assert.equal(bridge.responses.length, 0);
});
test('Bridge: a read finishing after navigation to another repository path cannot expose data there', () => {
  const bridge = bridgeFixture(approvedOfficeUrls[0], false, (location) => { location.pathname = '/other/'; });
  bridge.send();
  assert.equal(bridge.calls.length, 1);
  assert.equal(bridge.responses.length, 0);
});
