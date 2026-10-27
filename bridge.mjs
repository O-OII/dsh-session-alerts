/** Official Connection RPC channel; callers retain the Host's authentication/trust fence. */
export const CHANNEL = '/native-taskbar-badge';
const failure = (code, message) => ({ ok: false, error: { code, message } });
/** Cordis traces service getters through the provider's shadow context. Supply
 * the already-injected server as public context metadata so Connection's rpc
 * getter cannot accidentally require it from the credentials-only provider.
 * Own the returned disposer explicitly; authentication stays with Connection.
 */
export function registerBridge(ctx, controller, isDisposed = () => false) {
  const rpcContext = ctx.extend({ webServer: ctx.webServer });
  return ctx.effect(() => rpcContext.connection.rpc.handle(CHANNEL, createBridge(controller, isDisposed)),
    'taskbar badge: authenticated read-receipt route');
}
export function createBridge(controller, isDisposed = () => false) {
  return (endpoint, payload, signal, peer) => {
    if (isDisposed() || signal?.aborted || peer?.signal?.aborted) return failure('badge/unavailable', 'Badge is not available.');
    if (peer?.principal?.kind !== 'owner') return failure('badge/forbidden', 'Owner access required.');
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
        typeof payload.sessionId !== 'string' || !payload.sessionId.trim() || payload.sessionId.length > 512) {
      return failure('badge/bad-request', 'Expected one session identity.');
    }
    if (endpoint === 'pending') return { ok: true, value: controller.pendingFor(payload.sessionId) };
    if (endpoint !== 'read') return failure('badge/not-found', 'Unknown badge operation.');
    // Only the actual rendered result-tail bridge acknowledges terminal results.
    // Waiting interactions clear on their real answer/decision, never on session open.
    if (payload.kind !== 'terminal' || typeof payload.revision !== 'string' || payload.revision.length > 128 ||
        !Number.isSafeInteger(payload.turn) || payload.turn < 0 || !Number.isSafeInteger(payload.eventSeq) || payload.eventSeq < 0) {
      return failure('badge/bad-request', 'Expected an exact rendered result revision.');
    }
    return { ok: true, value: { accepted: controller.acknowledge(payload) } };
  };
}
