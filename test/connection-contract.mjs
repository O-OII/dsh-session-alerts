/** Read-only SDK contract runner. Executes exact shipped registration code, not
 * a copied/reimplemented method. Only registration is exercised; no live server.
 * Set DSH_BADGE_CONNECTION_SOURCE to the official connection/lib/index.js snapshot.
 */
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
export function officialConnectionRegister(path) {
  const source = readFileSync(path, 'utf8');
  const begin = source.indexOf('\n\tregister(owner, channel, handler) {');
  const end = source.indexOf('\n\tregisterInterceptor(', begin);
  const rpcBegin = source.indexOf('function rpcFetchHandler(channel, handler) {');
  const rpcEnd = source.indexOf('\nfunction invalidEnvelopeResponse(', rpcBegin);
  const assertion = /function assertChannel\(channel\) \{[\s\S]*?\n\}/.exec(source)?.[0];
  const pattern = /const CHANNEL_PATTERN = [^\n]+;/.exec(source)?.[0];
  if (begin < 0 || end < 0 || rpcBegin < 0 || rpcEnd < 0 || !assertion || !pattern) {
    throw new Error('Official Connection registration shape changed; inspect its contract before updating this runner.');
  }
  return vm.runInNewContext(`${pattern}\n${assertion}\n${source.slice(rpcBegin, rpcEnd)}\n({${source.slice(begin, end)}\n}).register`, {}, { filename: path });
}
export function guardedServices(services, injected) {
  const dependencies = new Set(injected);
  return new Proxy(services, { get(target, key, receiver) {
    if (['connection', 'webServer', 'sessionProjections', 'subprocess'].includes(key) && !dependencies.has(key)) {
      throw new Error(`cannot get property "${key}" without inject`);
    }
    return Reflect.get(target, key, receiver);
  } });
}
