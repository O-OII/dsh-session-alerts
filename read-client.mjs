/** Browser-independent read-receipt driver. No title/DOM discovery or session-open heuristics.
 * getView() must prove a mounted official result tail, exact turn/end seq, active main
 * binding, page visibility/focus and current IntersectionObserver intersection.
 * Never store a durable "active session" at the Host: an old window/connection lease
 * must not acknowledge a newer result. Every send carries the exact revision observed.
 */
export const CHANNEL = '/native-taskbar-badge';
export function createReadReceipt({ getView, getGeneration, call, schedule = setTimeout,
  cancel = clearTimeout, interval = 1000, onError = () => {} }) {
  let stopped = false, timer = null, running = false, rerun = false, request = null;
  let accepted = null;
  const eligible = (view) => view?.active === true && view.visible === true && view.focused === true &&
    view.intersecting === true && typeof view.sessionId === 'string' &&
    Number.isSafeInteger(view.turn) && view.turn >= 0 && Number.isSafeInteger(view.eventSeq) && view.eventSeq >= 0;
  function sameView(a, b) {
    return eligible(b) && a.sessionId === b.sessionId && a.turn === b.turn && a.eventSeq === b.eventSeq;
  }
  async function run() {
    if (stopped) return;
    if (running) { rerun = true; return; }
    cancel(timer); timer = null;
    const view = getView(), generation = getGeneration();
    if (!eligible(view) || !generation) return;
    const key = `${generation.id}:${view.sessionId}:${view.turn}:${view.eventSeq}`;
    if (accepted === key) return;
    running = true; request = new AbortController();
    const controller = request;
    const stillVisible = () => !stopped && !controller.signal.aborted &&
      getGeneration() === generation && sameView(view, getView());
    try {
      const result = await call(CHANNEL, 'pending', { sessionId: view.sessionId }, controller.signal);
      if (!stillVisible() || !result?.ok) return;
      const item = result.value;
      if (!item || item.kind !== 'terminal' || item.turn !== view.turn || item.eventSeq !== view.eventSeq ||
          typeof item.revision !== 'string') return;
      const response = await call(CHANNEL, 'read', {
        sessionId: view.sessionId, revision: item.revision, kind: item.kind,
        turn: view.turn, eventSeq: view.eventSeq,
      }, controller.signal);
      if (stillVisible() && response?.ok && response.value?.accepted === true) accepted = key;
    } catch (error) {
      if (!controller.signal.aborted) onError(error);
    } finally {
      running = false; request = null;
      if (!stopped && rerun) { rerun = false; void run(); }
      else if (!stopped && eligible(getView()) && getGeneration() && accepted !== key) timer = schedule(() => void run(), interval);
    }
  }
  return {
    refresh() {
      // Invalidate in-flight evidence even on visible→hidden→visible round trips.
      request?.abort();
      cancel(timer); timer = null;
      void run();
    },
    stop() { stopped = true; cancel(timer); request?.abort(); },
  };
}

/** DSH-native current-view reads need not scroll to a historical result footer.
 * Never bulk-ack a fresh page's default false unread flags. Only its ready,
 * retained, visible and focused CURRENT main session can acknowledge a terminal.
 */
export function createNativeReadReceipt({ getView, getGeneration, call, schedule = setTimeout,
  cancel = clearTimeout, interval = 2000, onError = () => {} }) {
  let stopped = false, timer = null, running = false, rerun = false, request = null;
  const eligible = v => v?.active === true && v.ready === true && v.nativeRead === true &&
    v.visible === true && v.focused === true && typeof v.sessionId === 'string' && v.sessionId.length > 0;
  async function run() {
    if (stopped) return;
    if (running) { rerun = true; return; }
    cancel(timer); timer = null;
    const view = getView(), generation = getGeneration();
    if (!eligible(view) || !generation) return;
    running = true; const controller = new AbortController(); request = controller;
    const valid = () => { const v = getView(); return !stopped && !controller.signal.aborted &&
      getGeneration() === generation && eligible(v) && v.sessionId === view.sessionId; };
    try {
      const result = await call(CHANNEL, 'pending', { sessionId: view.sessionId }, controller.signal);
      if (!valid() || !result?.ok) return;
      const item = result.value;
      if (!item || item.kind !== 'terminal' || typeof item.revision !== 'string' ||
          !Number.isSafeInteger(item.turn) || item.turn < 0 || !Number.isSafeInteger(item.eventSeq) || item.eventSeq < 0) return;
      await call(CHANNEL, 'read', { sessionId: view.sessionId, kind: 'terminal',
        revision: item.revision, turn: item.turn, eventSeq: item.eventSeq }, controller.signal);
    } catch (error) { if (!controller.signal.aborted) onError(error); }
    finally {
      running = false; request = null;
      if (!stopped && rerun) { rerun = false; void run(); }
      else if (!stopped && eligible(getView()) && getGeneration()) timer = schedule(() => void run(), interval);
    }
  }
  return {
    refresh() { if (stopped) return; request?.abort(); cancel(timer); timer = null; void run(); },
    stop() { stopped = true; rerun = false; cancel(timer); timer = null; request?.abort(); },
  };
}

/** Public sources only; install once globally, independently of turnTail slots. */
export function applyNativeReadSync(ctx) {
  const list = ctx.sessions?.list, current = ctx.uiSession?.current;
  const statuses = ctx.uiSession?.sessionStatus, generation = ctx.connection?.generation;
  if ([list, current, statuses, generation].some(s => typeof s?.getSnapshot !== 'function' || typeof s?.subscribe !== 'function')) return false;
  ctx.effect(() => {
    const driver = createNativeReadReceipt({
      getGeneration: () => generation.getSnapshot(), call: (...args) => ctx.connection.rpc.call(...args),
      getView: () => {
        const sessionId = current.getSnapshot()?.key, catalog = list.getSnapshot();
        const row = catalog?.byId?.[sessionId], status = statuses.getSnapshot()?.get(sessionId);
        const main = row && row.origin !== 'subagent' && row.header?.origin !== 'subagent' &&
          (row.delegationDepth ?? row.header?.delegationDepth ?? 0) === 0;
        const mainViewCount = row?.retainedBy?.mainView;
        return { sessionId, ready: catalog?.phase === 'ready' && row?.blank === false,
          active: Boolean(main && Number.isSafeInteger(mainViewCount) && mainViewCount > 0), nativeRead: status?.completionUnread === false,
          visible: document.visibilityState === 'visible', focused: document.hasFocus() };
      },
    });
    const refresh = () => driver.refresh();
    const stops = [list, current, statuses, generation].map(s => s.subscribe(refresh));
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh); window.addEventListener('blur', refresh); refresh();
    return () => {
      driver.stop(); for (const stop of stops) stop(); document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh); window.removeEventListener('blur', refresh);
    };
  }, 'taskbar badge: native main-view read synchronization');
  return true;
}
