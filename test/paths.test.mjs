import test from 'node:test';
import assert from 'node:assert/strict';
import { win32 as path } from 'node:path';
import { resolvePaths } from '../paths.mjs';
const desktop = 'C:\\Apps\\DSH\\DeepSeek Harness.exe';
const python = 'C:\\Runtime\\Python\\python.exe';
const normalize = value => path.normalize(value).toLowerCase();
function runtime(files = [], more = {}) {
  const allowed = new Set(files.map(normalize));
  return { env: {}, execPath: 'C:\\Node\\node.exe', hostEntry: 'C:\\Host\\index.mjs',
    isFile: value => allowed.has(normalize(value)), ...more };
}

test('explicit existing absolute Windows files take precedence', () => {
  const result = resolvePaths({ desktopExecutable: desktop, pythonPath: python }, runtime([desktop, python], {
    env: { DSH_DESKTOP_EXECUTABLE: 'C:\\wrong.exe', DSH_PYTHON_PATH: 'C:\\wrong\\python.exe' },
  }));
  assert.deepEqual(result, { desktopExecutable: desktop, pythonPath: python, errors: [] });
});
test('known user-provided environment overrides work without profile scans', () => {
  assert.deepEqual(resolvePaths({}, runtime([desktop, python], { env: { DSH_DESKTOP_EXECUTABLE: desktop, DSH_PYTHON_PATH: python } })).errors, []);
});
test('current packaged DSH executable and DSH_HOME official Python are discovered', () => {
  const bundled = 'C:\\KnownHome\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\python\\python.exe';
  const result = resolvePaths({}, runtime([desktop, bundled], { execPath: desktop, env: { DSH_HOME: 'C:\\KnownHome' } }));
  assert.equal(result.desktopExecutable, desktop);
  assert.equal(result.pythonPath, bundled);
  assert.deepEqual(result.errors, []);
});
test('packaged Host entry can locate desktop independently of Host node executable', () => {
  const result = resolvePaths({ pythonPath: python }, runtime([desktop, python], { hostEntry: 'C:/Apps/DSH/resources/app.asar/dsh/bin/host.mjs' }));
  assert.equal(normalize(result.desktopExecutable), normalize(desktop));
  assert.deepEqual(result.errors, []);
});
test('desktop official bundled Python fallback is bounded to a single known location', () => {
  const bundled = 'C:\\Apps\\DSH\\resources\\runtime\\python\\python.exe';
  const seen = [];
  const result = resolvePaths({}, runtime([], { execPath: desktop, isFile(value) { seen.push(value); return [desktop, bundled].map(normalize).includes(normalize(value)); } }));
  assert.equal(result.pythonPath, bundled);
  assert.deepEqual(result.errors, []);
  assert.ok(seen.every(value => normalize(value).startsWith(normalize('C:\\Apps\\DSH'))));
});
test('Electron, node, pythonw and arbitrary executables never become Python', () => {
  for (const candidate of ['electron.exe', 'node.exe', 'pythonw.exe', 'DeepSeek Harness.exe']) {
    const wrong = `C:\\Runtime\\${candidate}`;
    assert.deepEqual(resolvePaths({ desktopExecutable: desktop, pythonPath: wrong }, runtime([desktop, wrong], { execPath: wrong })).errors, ['pythonPath']);
  }
});
test('bare Electron and node hosts do not imply a DSH desktop', () => {
  for (const execPath of ['C:\\Apps\\electron.exe', 'C:\\Apps\\node.exe']) {
    assert.deepEqual(resolvePaths({}, runtime([execPath], { execPath })).errors, ['desktopExecutable', 'pythonPath']);
  }
});
test('invalid explicit values fail closed instead of silently choosing discovered paths', () => {
  const r = runtime([desktop, python], { execPath: desktop, env: { DSH_PYTHON_PATH: python } });
  for (const value of ['relative.exe', '', 'C:\\missing.exe']) {
    if (value) assert.ok(resolvePaths({ desktopExecutable: value }, r).errors.includes('desktopExecutable'));
  }
  assert.ok(resolvePaths({ pythonPath: 'C:\\missing\\python.exe' }, r).errors.includes('pythonPath'));
});
test('relative DSH_HOME, USERPROFILE and PATH never trigger private-directory searching', () => {
  const seen = [];
  const result = resolvePaths({}, runtime([], { env: { DSH_HOME: 'relative', USERPROFILE: 'C:\\Private', PATH: 'C:\\Private' }, isFile: value => { seen.push(value); return false; } }));
  assert.deepEqual(result.errors, ['desktopExecutable', 'pythonPath']);
  assert.deepEqual(seen, []);
});
test('directories, NUL and relative configuration paths are rejected', () => {
  const result = resolvePaths({ desktopExecutable: 'C:\\Directory.exe', pythonPath: 'python.exe' }, runtime());
  assert.deepEqual(result.errors, ['desktopExecutable', 'pythonPath']);
  assert.ok(resolvePaths({ desktopExecutable: 'C:\\bad\0.exe', pythonPath: python }, runtime([python])).errors.includes('desktopExecutable'));
});
