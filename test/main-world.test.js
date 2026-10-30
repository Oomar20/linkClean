// Runs the content scripts in a sandbox with minimal fakes of the browser APIs they hook.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scripts = ['clean.js', 'main-world.js'].map((name) =>
  fs.readFileSync(path.join(__dirname, '..', 'src', name), 'utf8')
);

function loadPage(href) {
  const calls = { writeText: [], setData: [], history: [] };
  const listeners = {};

  class Clipboard {
    writeText(text) {
      calls.writeText.push(text);
      return Promise.resolve();
    }
  }
  class DataTransfer {
    constructor() {
      this.data = {};
    }
    setData(type, value) {
      calls.setData.push([type, value]);
      this.data[type] = value;
    }
  }
  class History {
    constructor() {
      this.state = null;
    }
    pushState(state, unused, url) {
      calls.history.push(['push', url]);
      if (url != null) location.href = new URL(String(url), location.href).href;
    }
    replaceState(state, unused, url) {
      calls.history.push(['replace', url]);
      if (url != null) location.href = new URL(String(url), location.href).href;
    }
  }

  const location = { href };
  const document = {
    activeElement: null,
    selection: '',
    getSelection() {
      return { toString: () => document.selection };
    },
    addEventListener(type, fn) {
      listeners[type] = fn;
    },
  };

  const sandbox = {
    Clipboard,
    DataTransfer,
    History,
    URL,
    console,
    document,
    location,
    history: new History(),
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const source of scripts) vm.runInContext(source, sandbox);

  return { sandbox, calls, listeners, location, document };
}

test('cleans the address bar on load', () => {
  const page = loadPage('https://x.com/a/status/1?s=20&t=abc');
  assert.equal(page.location.href, 'https://x.com/a/status/1');
});

test('leaves non-post pages alone on load', () => {
  const page = loadPage('https://x.com/search?q=cats');
  assert.equal(page.location.href, 'https://x.com/search?q=cats');
  assert.equal(page.calls.history.length, 0);
});

test('cleans in-page navigation, including relative URLs', () => {
  const page = loadPage('https://x.com/home');
  page.sandbox.history.pushState({}, '', '/a/status/1?s=20');
  assert.equal(page.location.href, 'https://x.com/a/status/1');
  page.sandbox.history.replaceState({}, '', '/search?q=x');
  assert.equal(page.location.href, 'https://x.com/search?q=x');
  page.sandbox.history.replaceState({ keep: true }, '');
  assert.deepEqual(page.calls.history.at(-1), ['replace', undefined]);
});

test('cleans navigator.clipboard.writeText', async () => {
  const page = loadPage('https://x.com/home');
  const clipboard = new page.sandbox.Clipboard();
  await clipboard.writeText('https://x.com/a/status/1?s=20');
  await clipboard.writeText('hello');
  assert.deepEqual(page.calls.writeText, ['https://x.com/a/status/1', 'hello']);
});

test('cleans DataTransfer.setData for text types only', () => {
  const page = loadPage('https://x.com/home');
  const dt = new page.sandbox.DataTransfer();
  dt.setData('text/plain', 'https://x.com/a/status/1?s=20');
  dt.setData('Text', 'https://x.com/a/status/2?s=20');
  dt.setData('application/json', 'https://x.com/a/status/3?s=20');
  assert.deepEqual(dt.data, {
    'text/plain': 'https://x.com/a/status/1',
    Text: 'https://x.com/a/status/2',
    'application/json': 'https://x.com/a/status/3?s=20',
  });
});

test('copy event rewrites a selected post link', () => {
  const page = loadPage('https://x.com/home');
  const event = {
    clipboardData: new page.sandbox.DataTransfer(),
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
  };

  page.document.selection = 'see https://x.com/a/status/1?s=20';
  page.listeners.copy(event);
  assert.equal(event.prevented, true);
  assert.equal(event.clipboardData.data['text/plain'], 'see https://x.com/a/status/1');

  const plain = { ...event, prevented: false, clipboardData: new page.sandbox.DataTransfer() };
  page.document.selection = 'nothing to clean';
  page.listeners.copy(plain);
  assert.equal(plain.prevented, false);
});

test('copy event reads selections inside text fields', () => {
  const page = loadPage('https://x.com/home');
  page.document.activeElement = {
    tagName: 'TEXTAREA',
    value: 'xx https://x.com/a/status/1?s=20 yy',
    selectionStart: 3,
    selectionEnd: 32,
  };
  const event = { clipboardData: new page.sandbox.DataTransfer(), preventDefault() {} };
  page.listeners.copy(event);
  assert.equal(event.clipboardData.data['text/plain'], 'https://x.com/a/status/1');
});
