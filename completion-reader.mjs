/** Official cold projection reader. No retain/open, catalog writes or log reads.
 * Four workers maximum; cache/invalidation belongs to the caller's model.
 */
import { COMPLETION_KEY, parseCompletionView } from './completion-contract.mjs';
export function createCompletionReader(remote, { concurrency = 4 } = {}) {
  return async function classify(sessionIds, signal) {
    const ids = [...new Set(sessionIds)], sessions = new Array(ids.length);
    let next = 0;
    async function worker() {
      while (next < ids.length) {
        signal?.throwIfAborted();
        const index = next++, sessionId = ids[index];
        let item = { sessionId, state: 'unknown' };
        try {
          const result = await remote.session.projections({ sessionId }, signal);
          signal?.throwIfAborted();
          const value = result?.ok ? result.value : null;
          if (value?.kind === 'sequenced' && Number.isSafeInteger(value.asOfSeq) && value.asOfSeq >= -1) {
            const projection = parseCompletionView(value.values?.[COMPLETION_KEY]);
            if (projection.eventSeq === null || projection.eventSeq <= value.asOfSeq) {
              const activeQuestions = value.values?.userQuestions?.active;
              const waiting = Array.isArray(activeQuestions) && activeQuestions.length > 0;
              item = { sessionId, state: !projection.main ? 'incomplete' : waiting ? 'waiting' : projection.state,
                projection, asOfSeq: value.asOfSeq };
            }
          }
        } catch (error) { if (signal?.aborted) throw error; }
        sessions[index] = item;
      }
    }
    await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), 4, ids.length) }, worker));
    return { ok: true, value: { sessions } };
  };
}
