/** Full official Cordis + complete Connection-class regression, no live server.
 * Set DSH_BADGE_SDK_ROOT to an extracted official node_modules dependency closure.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerBridge } from '../bridge.mjs';
import { createController } from '../controller.mjs';
assert.ok(process.env.DSH_BADGE_SDK_ROOT, 'Set DSH_BADGE_SDK_ROOT to the official extracted node_modules directory.');
const sdk = process.env.DSH_BADGE_SDK_ROOT;
const { Context } = await import(pathToFileURL(resolve(sdk, '@deepseek-ai/cordis/lib/index.js')).href);
const { HostConnectionService } = await import(pathToFileURL(resolve(sdk, '@deepseek-ai/dsh-client-connection/lib/index.js')).href);
async function fixture() {
  const root = new Context(), routes = new Map();
  const server = root.plugin({ name: 'test-webserver', apply(ctx) {
    ctx.provide('webServer', { host: '127.0.0.1', protocol: 'http:', register(route) {
      if (routes.has(route.path)) throw new Error('Duplicate route');
      routes.set(route.path, route); return () => routes.delete(route.path);
    } });
  } });
  await server.await();
  // Deliberately no webServer injection on the Connection provider, matching
  // the real credentials-only provider. Use the COMPLETE SDK class and getter.
  const connection = root.plugin({ name: 'test-connection', apply(ctx) {
    new HostConnectionService(ctx, [], { isAuthenticated: () => false, authenticateApi: () => undefined });
  } });
  await connection.await();
  return { root, routes, server, connection, async close() { await connection.dispose(); await server.dispose(); } };
}

test('full Cordis + actual rpc getter reproduces provider-shadow failure despite consumer webServer inject', async () => {
  const f = await fixture();
  const badge = f.root.plugin({ name: 'old-badge-route', inject: ['connection', 'webServer'], apply(ctx) {
    ctx.connection.rpc.handle('/native-taskbar-badge', () => ({ ok: true, value: null }));
  } });
  try {
    await assert.rejects(badge.await(), /cannot get property "webServer" without inject/);
    assert.equal(f.routes.size, 0);
  } finally { await badge.dispose(); await f.close(); }
});

test('production public-context registration works through full getter and keeps actual authentication gate', async () => {
  const f = await fixture();
  const badge = f.root.plugin({ name: 'fixed-badge-route', inject: ['connection', 'webServer'], apply(ctx) {
    registerBridge(ctx, createController());
  } });
  try {
    await badge.await(); assert.equal(f.routes.size, 1);
    const route = f.routes.get('/native-taskbar-badge');
    assert.equal(route.kind, 'prefix'); assert.equal(typeof route.handler, 'function');
    let status, body;
    await route.handler({ headers: { host: '127.0.0.1:1234' }, url: '/native-taskbar-badge/pending', method: 'POST' },
      { writeHead(value) { status = value; }, end(value) { body = value; } });
    assert.equal(status, 401); assert.equal(body, 'unauthorized');
    await badge.dispose(); assert.equal(f.routes.size, 0);
    await f.connection.await(); assert.equal(f.connection.state, 2); // Provider remains ACTIVE.
  } finally { await badge.dispose(); await f.close(); }
});

test('production route is consumer-owned across repeated restart/disable/re-enable with provider alive', async () => {
  const f = await fixture();
  const plugin = { name: 'fixed-badge-lifecycle', inject: ['connection', 'webServer'], apply(ctx) {
    registerBridge(ctx, createController());
  } };
  let badge = f.root.plugin(plugin);
  try {
    await badge.await(); assert.equal(f.routes.size, 1);
    await badge.restart(); assert.equal(f.routes.size, 1);
    await badge.dispose(); assert.equal(f.routes.size, 0);
    badge = f.root.plugin(plugin); await badge.await(); assert.equal(f.routes.size, 1);
    await badge.dispose(); assert.equal(f.routes.size, 0);
  } finally { await badge.dispose(); await f.close(); }
});
