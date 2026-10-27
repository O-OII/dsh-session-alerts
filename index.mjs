/** Windows badge host and authenticated, revision-safe client read receipts. */
import { createRequire } from 'node:module';
// Resolve the shipped SDK from the actual Host entry, not this linked workspace.
// No SDK package is downloaded or installed into the user's profile.
const z = createRequire(process.argv[1])('@deepseek-ai/schemastery');
import { writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolvePaths } from './paths.mjs';
import { languageOf, translate } from './i18n.mjs';
import { createConfig } from './config.mjs';
import { createController } from './controller.mjs';
import { definition, KEY } from './projection.mjs';
import { registerBridge } from './bridge.mjs';

export const name = 'native-taskbar-badge';
// Connection.rpc.handle() registers a route using the caller's scoped webServer.
// Declare that transitive service read explicitly (required by Cordis rc.3).
export const inject = ['subprocess', 'sessionProjections', 'connection', 'webServer'];
const directory = dirname(fileURLToPath(import.meta.url));
export const Config = createConfig(z);

export function apply(ctx, config) {
  const language = languageOf(config.language);
  const t = (key, values) => translate(language, `messages.${key}`, values);
  const statusPath = join(directory, 'runtime-status.json');
  const startedAt = new Date().toISOString();
  let disposed = false;
  let handle = null;
  let ready = false;
  let lastSent = null;
  let restartTimer = null;
  let readyTimer = null;
  let restarts = 0;
  let generation = 0;
  let phase = 'starting';
  let lastError = null;
  let native = null;
  let controller;
  function status() {
    const record = { version: '0.2.1', mounted: !disposed, phase, startedAt, updatedAt: new Date().toISOString(),
      hostPid: process.pid, helperReady: ready, helperGeneration: generation, restarts,
      ...controller?.snapshot(), native, lastError };
    try {
      writeFileSync(statusPath + '.tmp', JSON.stringify(record, null, 2) + '\n', 'utf8');
      renameSync(statusPath + '.tmp', statusPath);
    } catch (error) {
      ctx.logger?.warn?.(t('diagnostics', { detail: error.message }));
    }
  }
  function sendCount(value) {
    if (!ready || disposed || !handle?.stdin?.writable || value === lastSent) return;
    try {
      handle.stdin.write(JSON.stringify({ type: 'set', count: value }) + '\n');
      lastSent = value;
    } catch (error) { lastError = error.message; status(); }
  }
  controller = createController({ ...config, onCount: sendCount, onChange: status });
  if (process.platform !== 'win32' || !config.enabled) {
    phase = process.platform !== 'win32' ? 'unsupported-platform' : 'disabled'; status();
    ctx.effect(() => () => { disposed = true; status(); }, 'taskbar badge: inactive diagnostics');
    return;
  }
  const paths = resolvePaths(config);
  if (paths.errors.length) {
    phase = 'configuration-error'; lastError = t('configuration', { field: paths.errors.join(', ') }); status();
    ctx.logger?.warn?.(lastError);
    ctx.effect(() => () => { disposed = true; status(); }, 'taskbar badge: invalid configuration diagnostics');
    return;
  }
  // The framework owns incremental session folding. Only live publication edges
  // below can create an unread item; loading a historical projection never does.
  registerBridge(ctx, controller, () => disposed);
  ctx.sessionProjections.register(definition);
  const projectionFor = (session) => ctx.sessionProjections.stateOf(session, KEY);
  ctx.on('session/event', (session, event) => {
    if (disposed || !['turn/start', 'turn/end', 'approval/asked', 'approval/decided'].includes(event.type)) return;
    try { controller.sessionEvent(session, event, projectionFor(session)); }
    catch (error) { lastError = error.message; status(); }
  }, { global: true });
  ctx.on('session/disposed', (session) => controller.sessionDisposed(session), { global: true });
  // An around-listener observes the actual ask operation (including nested tool
  // calls) and always returns the next listener's result without altering it.
  ctx.on('tools/execute', async (exec, next) => {
    let token = null;
    if (!disposed && exec?.name === 'ask_user_question') {
      try { token = controller.questionStarted(exec, projectionFor(exec.agent.session)); }
      catch (error) { lastError = error.message; status(); }
    }
    try { return await next(); }
    finally { if (!disposed) controller.questionResolved(token); }
  }, { global: true });

  function onNative(message, currentGeneration) {
    if (disposed || currentGeneration !== generation) return;
    if (message.type === 'ready') {
      clearTimeout(readyTimer);
      ready = true; phase = 'running'; lastError = null; native = { helperPid: message.pid, windows: message.windows, count: 0 };
      lastSent = null; sendCount(controller.snapshot().pendingCount);
    } else if (message.type === 'applied') {
      if (phase === 'degraded') { phase = 'running'; lastError = null; }
      native = { ...native, count: message.count, windows: message.windows, visible: message.visible,
        hresult: message.hresult ?? null, reason: message.reason ?? null };
    } else if (message.type === 'error' || message.type === 'fatal') {
      lastError = t('native', { detail: String(message.message).slice(0, 1000) }); phase = message.type === 'fatal' ? 'helper-error' : 'degraded';
    }
    status();
  }
  function start() {
    if (disposed) return;
    ready = false; lastSent = null; phase = 'starting'; const currentGeneration = ++generation;
    let current;
    try {
      current = ctx.subprocess.spawn({
        argv: [paths.pythonPath, '-I', '-u', join(directory, 'native.py'), '--executable', paths.desktopExecutable,
          '--assets', join(directory, 'assets/badges'), '--locale', language],
        cwd: directory,
        stdio: { stdin: 'pipe', stdout: 'pipe', stderr: { maxBytes: 8192 } },
        graceMs: 1800,
      });
      handle = current;
      if (!current.stdout || !current.stdin) throw new Error(t('pipes'));
      let pending = '';
      current.stdout.setEncoding('utf8');
      current.stdout.on('data', (data) => {
        if (disposed || currentGeneration !== generation) return;
        pending += data;
        if (pending.length > 65536) { lastError = t('buffer'); pending = ''; status(); return; }
        let end;
        while ((end = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, end); pending = pending.slice(end + 1);
          try { onNative(JSON.parse(line), currentGeneration); }
          catch (error) { lastError = t('response', { detail: error.message }); status(); }
        }
      });
      readyTimer = setTimeout(() => {
        if (!disposed && currentGeneration === generation && !ready) {
          phase = 'helper-error'; lastError = t('timeout'); status();
          try { current.terminate(); } catch {}
        }
      }, 8000);
      readyTimer.unref?.();
      // A pipe error must never become an unhandled EventEmitter exception.
      current.stdout.on('error', (error) => { if (!disposed) { lastError = error.message; status(); } });
      current.stdin.on('error', (error) => { if (!disposed) { lastError = error.message; status(); } });
      const ended = (outcome) => {
        if (disposed || currentGeneration !== generation) return;
        clearTimeout(readyTimer);
        ready = false; phase = 'helper-stopped';
        lastError = outcome instanceof Error ? outcome.message : t('exit', { code: outcome?.exitCode ?? 'unknown' });
        if (restarts < 3) {
          const delay = 1000 * (2 ** restarts++);
          restartTimer = setTimeout(start, delay); restartTimer.unref?.();
        }
        status();
      };
      current.done.then(ended, ended);
    } catch (error) {
      ready = false; phase = 'helper-error'; lastError = error.message;
      try { current?.terminate?.(); } catch {}
    }
    status();
  }
  ctx.effect(() => {
    start();
    return async () => {
      disposed = true; ready = false; phase = 'stopped'; clearTimeout(restartTimer); clearTimeout(readyTimer);
      const current = handle; handle = null;
      if (current) {
        try { current.stdin?.end(JSON.stringify({ type: 'quit' }) + '\n'); } catch {}
        let timer;
        const finished = await Promise.race([
          current.done.then(() => true, () => true),
          new Promise((resolve) => { timer = setTimeout(() => resolve(false), 2000); }),
        ]);
        clearTimeout(timer);
        if (!finished) {
          try {
            current.terminate();
            await current.waitForExit?.(AbortSignal.timeout(2000));
          } catch {}
        }
      }
      native = { ...native, count: 0 }; status();
    };
  }, 'taskbar badge: managed native helper');
}
