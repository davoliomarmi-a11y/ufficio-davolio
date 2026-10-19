import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { normalizeReading, safeLink } from '../public/open-tabs-data.js';

const at = '2026-10-19T12:00:00.000Z';
function reading() {
  return {
    readAt: at,
    mail: { status: 'ok', accountEmail: 'davoliomarmi@gmail.com', items: [{ id: 'example', sender: 'Mittente di prova', subject: '<img src=x onerror=alert(1)>', snippet: 'Anteprima di prova', url: 'javascript:alert(1)', unread: true }] },
    orders: { status: 'ok', items: [{ number: '1151', customer: 'Cliente di prova', completedText: '19/10/2026' }] },
  };
}

test('keeps visible source text as text and excludes unsafe links', () => {
  const value = normalizeReading(reading(), Date.parse(at));
  assert.equal(value.mail.items[0].subject, '<img src=x onerror=alert(1)>');
  assert.equal(value.mail.items[0].url, null);
  assert.equal(value.orders.items[0].number, 1151);
  assert.equal(value.orders.items[0].completedAt, null);
  assert.equal(value.orders.items[0].completedText, '19/10/2026');
  assert.equal(safeLink('https://mail.google.com.evil.test/', 'mail.google.com'), null);
  assert.equal(safeLink('https://user:password@mail.google.com/', 'mail.google.com'), null);
  assert.equal(safeLink('https://mail.google.com/mail/u/0/#inbox', 'mail.google.com'), 'https://mail.google.com/mail/u/0/#inbox');
});

test('does not turn an unreadable or unverified empty source into a successful reading', () => {
  const value = reading();
  value.orders.items = [];
  assert.equal(normalizeReading(value, Date.parse(at)).orders.status, 'unrecognized');
  value.orders.emptyVerified = true;
  assert.equal(normalizeReading(value, Date.parse(at)).orders.status, 'ok');
  value.mail.accountEmail = 'different@example.com';
  assert.equal(normalizeReading(value, Date.parse(at)).mail.status, 'unrecognized');
});

test('a malformed order does not discard a valid mail reading', () => {
  const value = reading();
  value.orders.items[0].number = 'non verificato';
  const normalized = normalizeReading(value, Date.parse(at));
  assert.equal(normalized.orders.status, 'unrecognized');
  assert.equal(normalized.mail.status, 'ok');
  assert.equal(normalized.mail.items.length, 1);
});

test('rejects invalid or old capture timestamps and oversized source payloads', () => {
  assert.throws(() => normalizeReading({ ...reading(), readAt: 'not a date' }, Date.parse(at)), /Ora/);
  assert.throws(() => normalizeReading(reading(), Date.parse(at) + 180000), /Ora/);
  const value = reading();
  value.mail.items = Array(101).fill(value.mail.items[0]);
  assert.equal(normalizeReading(value, Date.parse(at)).mail.status, 'unrecognized');
});

async function makeBridge() {
  const listeners = [];
  const posted = [];
  const timers = new Map();
  let timerId = 0, id = 0;
  const location = { origin: 'http://127.0.0.1:5173' };
  const window = { addEventListener: (name, handler) => { if (name === 'message') listeners.push(handler); }, postMessage: (message, origin) => posted.push({ message, origin }) };
  const context = vm.createContext({ window, location, URL, Intl, Date, crypto: { randomUUID: () => `request-${++id}` }, setTimeout: callback => { const next = ++timerId; timers.set(next, callback); return next; }, clearTimeout: timer => timers.delete(timer) });
  const model = new vm.SourceTextModule(await readFile(new URL('../public/open-tabs-data.js', import.meta.url), 'utf8'), { context });
  const entry = new vm.SourceTextModule(await readFile(new URL('../public/open-tabs.js', import.meta.url), 'utf8'), { context });
  await entry.link(() => model);
  await entry.evaluate();
  return {
    api: entry.namespace.openTabs, posted, timers,
    answer(payload, change = {}) {
      for (const listener of listeners) listener({ source: window, origin: location.origin, data: { type: 'DAVOLIO_OPEN_TABS_RESULT', requestId: posted.at(-1).message.requestId, payload }, ...change });
    },
  };
}

test('bridge accepts only a correlated response from its own window and origin', async () => {
  const bridge = await makeBridge();
  const states = [];
  bridge.api.subscribe(state => states.push(state));
  const promise = bridge.api.read();
  assert.equal(bridge.api.read(), promise);
  assert.equal(bridge.posted.length, 1);
  const value = { ...reading(), readAt: new Date().toISOString() };
  bridge.answer(value, { origin: 'https://attacker.example' });
  bridge.answer(value, { source: {} });
  bridge.answer(value, { data: { type: 'DAVOLIO_OPEN_TABS_RESULT', requestId: 'wrong-id', payload: value } });
  assert.equal(states.at(-1).reading, true);
  assert.equal(states.at(-1).snapshot, null);
  bridge.answer(value);
  const result = await promise;
  assert.equal(result.mail.items.length, 1);
  assert.equal(states.at(-1).reading, false);
  assert.equal(bridge.timers.size, 0);
});

test('a missing extension times out and keeps the last successful reading', async () => {
  const bridge = await makeBridge();
  let state;
  bridge.api.subscribe(value => { state = value; });
  const first = bridge.api.read();
  bridge.answer({ ...reading(), readAt: new Date().toISOString() });
  await first;
  const snapshot = state.snapshot;
  const second = bridge.api.read();
  const rejected = assert.rejects(second, /Estensione non disponibile/);
  [...bridge.timers.values()][0]();
  await rejected;
  assert.equal(state.snapshot, snapshot);
  assert.equal(state.reading, false);
  assert.match(state.error, /Estensione non disponibile/);
});
