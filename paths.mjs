/** Bounded Windows discovery only: never search PATH, process titles or user folders. */
import { statSync } from 'node:fs';
import { win32 as path } from 'node:path';

export function resolvePaths(config = {}, runtime = {}) {
  const env = runtime.env ?? process.env;
  const execPath = runtime.execPath ?? process.execPath;
  const hostEntry = runtime.hostEntry ?? process.argv[1];
  const isFile = runtime.isFile ?? ((value) => { try { return statSync(value).isFile(); } catch { return false; } });
  const absolute = (value) => typeof value === 'string' && /^(?:[a-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+)/i.test(value) && path.isAbsolute(value);
  const valid = (value) => absolute(value) && !value.includes('\0') && isFile(value);
  const desktopName = (value) => path.basename(value ?? '').toLowerCase() === 'deepseek harness.exe';
  const pythonName = (value) => /^python(?:\d+(?:\.\d+)*)?\.exe$/i.test(path.basename(value ?? ''));
  const desktopCandidates = [];
  if (desktopName(execPath)) desktopCandidates.push(execPath);
  // Official packaged Host entry is below resources/app.asar/dsh; do not walk arbitrary ancestors.
  if (typeof hostEntry === 'string') {
    const match = hostEntry.replaceAll('\\', '/').match(/^(.*)\/resources\/app\.asar\/dsh\//i);
    if (match) desktopCandidates.push(path.join(match[1], 'DeepSeek Harness.exe'));
  }
  const desktopExplicit = config.desktopExecutable || env.DSH_DESKTOP_EXECUTABLE;
  const desktopExecutable = desktopExplicit || desktopCandidates.find(valid) || '';
  const pythonCandidates = [];
  if (absolute(env.DSH_HOME)) {
    pythonCandidates.push(path.join(env.DSH_HOME, 'dsh-runtimes/dsh-primary-runtime/dependencies/python/python.exe'));
  }
  if (absolute(desktopExecutable)) {
    pythonCandidates.push(path.join(path.dirname(desktopExecutable), 'resources/runtime/python/python.exe'));
  }
  const pythonExplicit = config.pythonPath || env.DSH_PYTHON_PATH;
  const pythonPath = pythonExplicit || pythonCandidates.find((value) => pythonName(value) && valid(value)) || '';
  const errors = [];
  if (!valid(desktopExecutable) || !/\.exe$/i.test(desktopExecutable)) errors.push('desktopExecutable');
  // Never use process.execPath as Python: the Host commonly runs inside Electron.
  if (!valid(pythonPath) || !pythonName(pythonPath)) errors.push('pythonPath');
  return { desktopExecutable, pythonPath, errors };
}
