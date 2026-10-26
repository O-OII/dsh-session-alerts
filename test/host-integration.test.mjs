import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, access } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PassThrough, Writable } from 'node:stream';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tick = () => new Promise((done) => setImmediate(done));
async function fixture(overrides = {}, spawnFailure = false, runtime = {}, timers = {}) {
  const writes = new Map(), events = new Map(), disposers = [], requests = [], handles = [];
  const fakeProcess = { platform: 'win32', env: {}, execPath: 'C:/Apps/DSH/DeepSeek Harness.exe', argv: ['fake-host', 'C:/Apps/DSH/resources/app.asar/dsh/bin.mjs'], pid: 1, ...runtime };
  const context = vm.createContext({ process: fakeProcess, console, setTimeout, clearTimeout, AbortSignal, URL, ...timers });
  const cache = new Map();
  const schema = () => ({ default() { return this; }, description() { return this; }, i18n() { return this; } });
  const fsStub = { readFileSync, statSync(path) { return { isFile: () => ['C:/Apps/DSH/DeepSeek Harness.exe', 'C:/Runtime/Python/python.exe'].includes(path.replaceAll('\\', '/')) }; }, writeFileSync(path, text) { writes.set(path, text); }, renameSync(from, to) { writes.set(to, writes.get(from)); writes.delete(from); } };
  async function load(path) {
    if (cache.has(path)) return cache.get(path);
    const code = await readFile(path, 'utf8');
    const module = new vm.SourceTextModule(code, { context, identifier: path, initializeImportMeta(meta) { meta.url = pathToFileURL(path).href; } });
    cache.set(path, module);
    await module.link(async (name, ref) => {
      if (name === 'node:module') {
        const value = { boolean: schema, string: schema, object: (fields) => Object.assign(schema(), { dict: fields }) };
        return new vm.SyntheticModule(['createRequire'], function () { this.setExport('createRequire', () => () => value); }, { context });
      }
      if (name === 'node:fs') return new vm.SyntheticModule(Object.keys(fsStub), function () { for (const [key, value] of Object.entries(fsStub)) this.setExport(key, value); }, { context });
      if (name.startsWith('node:')) {
        const value = await import(name);
        return new vm.SyntheticModule(Object.keys(value), function () { for (const [key, fn] of Object.entries(value)) this.setExport(key, fn); }, { context });
      }
      return load(resolve(dirname(ref.identifier), name));
    });
    return module;
  }
  const module = await load(resolve(root, 'index.mjs')); await module.evaluate();
  let projection;
  const projected = new WeakMap();
  const ctx = {
    logger: { warn() {} },
    sessionProjections: { register(value) { projection = value; }, stateOf(session) { return projected.get(session) ?? projection.init(); } },
    on(name, callback) { events.set(name, callback); return () => events.delete(name); },
    effect(callback) { disposers.push(callback()); },
    subprocess: { spawn(spec) {
      if (spawnFailure) throw new Error('controlled spawn failure');
      requests.push(spec); let finish; const done = new Promise((resolve) => { finish = resolve; });
      const stdout = new PassThrough(); let input = '';
      const commands = [];
      const stdin = new Writable({ write(chunk, _, next) {
        input += chunk.toString(); let end;
        while ((end = input.indexOf('\n')) >= 0) {
          const command = JSON.parse(input.slice(0, end)); input = input.slice(end + 1); commands.push(command);
          if (command.type === 'set') stdout.write(JSON.stringify({ type: 'applied', count: command.count, hwnd: 123, visible: true, hresult: 0 }) + '\n');
          if (command.type === 'quit') { stdout.end(); finish({ exitCode: 0, signal: null }); }
        }
        next();
      } });
      const handle = { stdin, stdout, done, commands, terminate() { finish({ exitCode: 1 }); }, async waitForExit() { await done; return true; } };
      handles.push(handle);
      queueMicrotask(() => stdout.write(JSON.stringify({ type: 'ready', focused: false, windows: [123], pid: 456 }) + '\n'));
      return handle;
    } },
  };
  const config = { enabled: true, desktopExecutable: 'C:/Apps/DSH/DeepSeek Harness.exe', pythonPath: 'C:/Runtime/Python/python.exe', notifyOnError: true, notifyOnWaiting: true, notifyOnGoalRounds: false, language: 'en', ...overrides };
  module.namespace.apply(ctx, config); await tick();
  function event(session, type, data) {
    const value = { type, data };
    projected.set(session, projection.apply(projected.get(session) ?? projection.init(), value));
    events.get('session/event')(session, value);
  }
  const status = () => JSON.parse([...writes].find(([path]) => path.endsWith('runtime-status.json'))[1]);
  const native = (value) => handles.at(-1).stdout.write(JSON.stringify(value) + '\n');
  return { events, requests, handles, event, status, native, writes, Config: module.namespace.Config, async close() { for (const cleanup of disposers.reverse()) await cleanup?.(); } };
}
const session = (id = 'main', depth = 0) => ({ id, header: { id, delegationDepth: depth } });

test('host lifecycle wires official APIs, counts real-shaped events and clears on native focus', async () => {
  const f = await fixture();
  try {
    assert.equal(f.status().version, '0.1.1');
    assert.equal(f.status().phase, 'running'); assert.equal(f.status().helperReady, true);
    assert.equal(f.requests.length, 1); assert.equal(f.requests[0].argv.includes('-I'), true);
    assert.deepEqual(Object.keys(f.requests[0].stdio).sort(), ['stderr', 'stdin', 'stdout']);
    const a = session('a'), b = session('b');
    f.event(a, 'turn/start', { turn: 1 }); f.event(a, 'turn/end', { turn: 1, reason: { kind: 'completed' } });
    assert.equal(f.status().pendingCount, 1); assert.equal(f.status().native.count, 1);
    const calls = f.handles[0].commands.length;
    f.event(a, 'turn/end', { turn: 1, reason: { kind: 'completed' } }); assert.equal(f.handles[0].commands.length, calls);
    f.event(b, 'turn/start', { turn: 1 }); f.event(b, 'turn/end', { turn: 1, reason: { kind: 'error' } }); assert.equal(f.status().native.count, 2);
    f.native({ type: 'focus', focused: true }); assert.equal(f.status().native.count, 0); assert.equal(f.status().pendingCount, 0);
    f.native({ type: 'focus', focused: false }); assert.equal(f.status().pendingCount, 0);
  } finally { await f.close(); }
  assert.equal(f.status().phase, 'stopped'); assert.equal(f.status().mounted, false);
  assert.equal(f.handles[0].commands.at(-1).type, 'quit');
  assert.ok([...f.writes.keys()].every((path) => path.endsWith('runtime-status.json')));
});

test('question waterfall preserves next result and clears wait in finally', async () => {
  const f = await fixture();
  try {
    const main = session(); f.event(main, 'turn/start', { turn: 1 });
    let release; const answer = new Promise((done) => { release = done; }); const result = { selected: ['yes'] };
    const work = f.events.get('tools/execute')({ name: 'ask_user_question', callId: 'call-1', agent: { session: main } }, () => answer);
    assert.equal(f.status().pendingCount, 1); release(result); assert.strictEqual(await work, result); assert.equal(f.status().pendingCount, 0);
    await assert.rejects(f.events.get('tools/execute')({ name: 'ask_user_question', callId: 'call-2', agent: { session: main } }, async () => { throw new Error('original failure'); }), /original failure/);
    assert.equal(f.status().pendingCount, 0);
  } finally { await f.close(); }
});

test('disabled configuration never launches helper', async () => {
  const f = await fixture({ enabled: false });
  try { assert.equal(f.requests.length, 0); assert.equal(f.status().phase, 'disabled'); }
  finally { await f.close(); }
});

test('synchronous provider failure is recorded without escaping apply', async () => {
  const f = await fixture({}, true);
  try { assert.equal(f.status().phase, 'helper-error'); assert.match(f.status().lastError, /controlled spawn failure/); }
  finally { await f.close(); }
});

test('invalid configured paths fail closed with localized actionable error and no helper', async () => {
  const f = await fixture({ pythonPath: 'C:/Runtime/electron.exe', language: 'zh' });
  try { assert.equal(f.requests.length, 0); assert.equal(f.status().phase, 'configuration-error'); assert.match(f.status().lastError, /pythonPath.*未启动/); }
  finally { await f.close(); }
});
test('non-Windows host is inert even with valid fake paths', async () => {
  const f = await fixture({}, false, { platform: 'linux' });
  try { assert.equal(f.requests.length, 0); assert.equal(f.status().phase, 'unsupported-platform'); }
  finally { await f.close(); }
});
test('unconfigured runtime missing Python never substitutes the Electron host', async () => {
  const f = await fixture({ desktopExecutable: '', pythonPath: '' });
  try { assert.equal(f.requests.length, 0); assert.equal(f.status().phase, 'configuration-error'); assert.match(f.status().lastError, /pythonPath.*No helper was started/); }
  finally { await f.close(); }
});
test('Chinese diagnostics select localized native accessibility description', async () => {
  const f = await fixture({ language: 'zh-CN' });
  try { assert.deepEqual(Array.from(f.requests[0].argv).slice(-2), ['--locale', 'zh']); }
  finally { await f.close(); }
});

function fakeTimers() {
  const pending = new Set();
  return { pending, setTimeout(fn, ms) { const timer = { fn, ms, unref() {} }; pending.add(timer); return timer; },
    clearTimeout(timer) { pending.delete(timer); },
    fire(ms) { const timer = [...pending].find(timer => timer.ms === ms); assert.ok(timer, `No ${ms}ms timer`); pending.delete(timer); timer.fn(); } };
}
test('owned helper crash retry is bounded to three attempts with 1/2/4 second backoff', async () => {
  const timers = fakeTimers();
  const f = await fixture({}, false, {}, timers);
  try {
    for (const delay of [1000, 2000, 4000]) {
      f.handles.at(-1).terminate(); await tick();
      assert.equal(f.status().phase, 'helper-stopped');
      timers.fire(delay); await tick();
      assert.equal(f.status().phase, 'running');
    }
    f.handles.at(-1).terminate(); await tick();
    assert.equal(f.requests.length, 4); assert.equal(f.status().restarts, 3);
    assert.equal(timers.pending.size, 0);
  } finally { await f.close(); }
});
test('disposal cancels a scheduled restart instead of leaking a new owned helper', async () => {
  const timers = fakeTimers();
  const f = await fixture({}, false, {}, timers);
  f.handles[0].terminate(); await tick();
  assert.ok([...timers.pending].some(timer => timer.ms === 1000));
  await f.close();
  assert.equal(timers.pending.size, 0); assert.equal(f.requests.length, 1);
  assert.equal(f.status().mounted, false); assert.equal(f.status().native.count, 0);
});


for (const [label, language, env, expected] of [
  ['missing language ignores English environment', undefined, { LANG: 'en_US.UTF-8' }, 'zh'],
  ['empty language', '', { LANG: 'en' }, 'zh'],
  ['null language', null, { LANG: 'en' }, 'zh'],
  ['unsupported language', 'fr', { LANG: 'en' }, 'zh'],
  ['explicit English ignores Chinese environment', 'en', { LANG: 'zh_CN.UTF-8' }, 'en'],
  ['explicit auto respects English environment', 'auto', { LANG: 'en_US.UTF-8' }, 'en'],
  ['explicit auto respects Chinese environment', 'auto', { LANG: 'zh_CN.UTF-8' }, 'zh'],
  ['explicit auto without environment', 'auto', {}, 'zh'],
  ['explicit auto with unsupported environment', 'auto', { LC_ALL: 'fr', LANG: 'en' }, 'zh'],
]) test(`host language regression: ${label}`, async () => {
  const running = await fixture({ language }, false, { env });
  try {
    assert.deepEqual(Array.from(running.requests[0].argv).slice(-2), ['--locale', expected]);
    running.native({ type: 'fatal', message: 'original provider detail' });
    assert.match(running.status().lastError, expected === 'zh' ? /原生辅助进程错误/ : /Native helper error/);
    assert.match(running.status().lastError, /original provider detail/);
  } finally { await running.close(); }
  const invalid = await fixture({ language, pythonPath: 'C:/Runtime/electron.exe' }, false, { env });
  try {
    assert.equal(invalid.requests.length, 0);
    assert.match(invalid.status().lastError, expected === 'zh' ? /未启动辅助进程/ : /No helper was started/);
  } finally { await invalid.close(); }
});
