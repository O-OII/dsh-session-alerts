/** Native workspace-slot contribution. File name retained for source compatibility;
 * the bell now filters unread sessions, never completed-session projections.
 */
import { createElement } from 'react';
import { createUnreadFilter, UNREAD_FILTER_ID } from './unread-filter.mjs';
import { SIDEBAR_NAMESPACE, sidebarMessages } from './sidebar-messages.mjs';
const buttonStyle = { width: 28, height: 28, flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: 0, borderRadius: 6, cursor: 'pointer', outlineOffset: 2, padding: 0 };
export function UnreadFilterButton({ wide = true, useUnreadFilter, setUnreadFilterEnabled, t }) {
  const enabled = useUnreadFilter(state => state.enabled);
  return createElement('button', { type: 'button', 'aria-label': t(enabled ? 'disableTooltip' : 'enableTooltip'), 'aria-pressed': enabled,
    title: t(enabled ? 'disableTooltip' : 'enableTooltip'), onClick: () => setUnreadFilterEnabled(!enabled),
    style: { ...buttonStyle, width: wide ? 28 : 36, height: wide ? 28 : 36,
      color: enabled ? 'var(--dsw-alias-state-business-primary, #3485ed)' : 'var(--dsw-alias-label-secondary, currentColor)',
      background: enabled ? 'var(--dsw-alias-interactive-bg-hover, rgba(52,133,237,.12))' : 'transparent' } },
    createElement('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none',
      stroke: 'currentColor', strokeWidth: 1, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      createElement('path', { d: 'M6.5 13a1.5 1.5 0 0 0 3 0M3 11.5h10l-1.25-1.75V6a3.75 3.75 0 0 0-7.5 0v3.75L3 11.5ZM8 1.25v1' })));
}
export function UnreadFilterStatus({ active, visibleCount, useUnreadFilter, setUnreadFilterEnabled, unavailable = false, t }) {
  if (unavailable) return createElement('div', { role: 'status', style: { padding: '8px 12px', fontSize: 12 } }, t('unavailable'));
  const enabled = useUnreadFilter(state => state.enabled);
  if (!enabled || !active || visibleCount > 0) return null;
  return createElement('div', { role: 'status', 'aria-live': 'polite',
    style: { padding: '8px 12px', fontSize: 12, color: 'var(--dsw-alias-label-secondary, currentColor)' } },
    createElement('div', null, t('empty')),
    createElement('button', { type: 'button', onClick: () => setUnreadFilterEnabled(false),
      style: { marginTop: 6, cursor: 'pointer' } }, t('clear')));
}
export function applyUnreadSidebar(ctx) {
  ctx.effect(() => ctx.locale.register(SIDEBAR_NAMESPACE, sidebarMessages), 'session alerts: unread sidebar dictionaries');
  const api = ctx.uiWorkspace.sessionFilters;
  if (api?.apiVersion !== 1 || typeof api.register !== 'function') {
    ctx.logger?.warn?.('DSH Session Alerts: unread workspace API unavailable; no fake toggle mounted.');
    ctx.slots.inject('sidebar.workspaces.filter.status', () => ctx.slots.register({
      name: 'sidebar.workspaces.filter.status', id: `${UNREAD_FILTER_ID}.unavailable`, locale: SIDEBAR_NAMESPACE,
      inject: () => ({ unavailable: true }),
    }, UnreadFilterStatus));
    return;
  }
  ctx.effect(() => {
    const model = createUnreadFilter({ sessions: ctx.sessions.list, statuses: ctx.uiSession.sessionStatus });
    let removeFilter, removeHeader, removeStatus;
    try {
      removeFilter = api.register({ id: UNREAD_FILTER_ID, source: model.source });
      const injected = () => ({ hooks: { unreadFilter: model.source }, setUnreadFilterEnabled: value => model.setEnabled(value) });
      removeHeader = ctx.slots.inject('sidebar.workspaces.header.action', () => ctx.slots.register({
        name: 'sidebar.workspaces.header.action', id: UNREAD_FILTER_ID, order: 50, locale: SIDEBAR_NAMESPACE, inject: injected,
      }, UnreadFilterButton));
      removeStatus = ctx.slots.inject('sidebar.workspaces.filter.status', () => ctx.slots.register({
        name: 'sidebar.workspaces.filter.status', id: UNREAD_FILTER_ID, order: 50, locale: SIDEBAR_NAMESPACE, inject: injected,
      }, UnreadFilterStatus));
    } catch (error) { model.dispose(); removeFilter?.(); removeHeader?.(); removeStatus?.(); throw error; }
    return () => { model.dispose(); removeHeader?.(); removeStatus?.(); removeFilter?.(); };
  }, 'session alerts: live unread-session sidebar');
}
