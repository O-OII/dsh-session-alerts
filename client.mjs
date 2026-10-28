/** Official client contribution: scoped native-read synchronization and exact Chat footer receipts. */
import { createElement, useEffect, useRef } from 'react';
import { createReadReceipt, applyNativeReadSync } from './read-client.mjs';
import { applyUnreadSidebar } from './completed-sidebar.mjs';
export const name = 'native-taskbar-badge-client';
export const inject = ['slots', 'sessions', 'uiSession', 'uiConversation', 'connection', 'remote', 'remote.session', 'locale', 'uiWorkspace'];
export function apply(ctx) {
  applyUnreadSidebar(ctx);
  applyNativeReadSync(ctx);
  function ResultReadMarker({ sessionId, turn: slotTurn, useBadgeChat }) {
    const marker = useRef(null);
    // Current Chat slots expose a TimelineTurn object; older SDKs passed the
    // numeric turn. Normalize only that identity, never trust slot seq/end as
    // read evidence. Keep the official Chat timeline lookup reactive below.
    const turn = typeof slotTurn === 'number' ? slotTurn : slotTurn?.turn;
    // The slot's seq can be the final assistant message seq, NOT turn/end.
    // Use the official Chat timeline's end seq for the read CAS proof instead.
    const eventSeq = useBadgeChat((chat) => chat?.timeline.turns.get(turn)?.end?.seq);
    useEffect(() => {
      const node = marker.current;
      if (!node || typeof IntersectionObserver !== 'function') return;
      let intersecting = false;
      const driver = createReadReceipt({
        getGeneration: () => ctx.connection.generation.getSnapshot(),
        call: (...args) => ctx.connection.rpc.call(...args),
        getView: () => {
          const rect = node.getBoundingClientRect();
          const painted = node.isConnected && rect.width > 0 && rect.height > 0 &&
            rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth &&
            (typeof node.checkVisibility !== 'function' || node.checkVisibility({ checkVisibilityCSS: true }));
          return { sessionId, turn, eventSeq,
            active: ctx.uiSession.current.getSnapshot().key === sessionId,
            visible: document.visibilityState === 'visible', focused: document.hasFocus(),
            intersecting: intersecting && painted };
        },
      });
      const refresh = () => driver.refresh();
      const observer = new IntersectionObserver((entries) => {
        intersecting = entries.some((entry) => entry.target === node && entry.isIntersecting && entry.intersectionRatio > 0);
        refresh();
      }, { threshold: [0, 1] });
      observer.observe(node);
      const unsubscribeCurrent = ctx.uiSession.current.subscribe(refresh);
      const unsubscribeGeneration = ctx.connection.generation.subscribe(refresh);
      document.addEventListener('visibilitychange', refresh);
      window.addEventListener('focus', refresh);
      window.addEventListener('blur', refresh);
      return () => {
        driver.stop(); observer.disconnect(); unsubscribeCurrent(); unsubscribeGeneration();
        document.removeEventListener('visibilitychange', refresh);
        window.removeEventListener('focus', refresh); window.removeEventListener('blur', refresh);
      };
    }, [sessionId, turn, eventSeq]);
    // One real pixel for intersection measurement; no text, no focusable control.
    return createElement('span', { ref: marker, 'aria-hidden': true,
      style: { display: 'block', width: 1, height: 1, marginBottom: -1, pointerEvents: 'none' } });
  }
  ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
    name: 'conversation.chat.turnTail', id: 'native-taskbar-badge.read', order: 10000,
    inject: (sessionId) => {
      const binding = ctx.sessions.binding(sessionId);
      if (!binding) throw new Error('Badge result marker requires a retained Session binding.');
      return { hooks: { badgeChat: ctx.uiConversation.binding(binding).target('chat') } };
    },
  }, ResultReadMarker));
}
