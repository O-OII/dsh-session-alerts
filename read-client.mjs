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
