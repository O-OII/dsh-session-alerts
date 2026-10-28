/** Official workspace-slot/filter contribution. No DOM discovery or hiding. */
import { createElement } from 'react';
import { createCompletedFilter, FILTER_ID } from './completed-filter.mjs';
import { createCompletionReader } from './completion-reader.mjs';
import { SIDEBAR_NAMESPACE, sidebarMessages } from './sidebar-messages.mjs';
const buttonStyle = { width: 28, height: 28, flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: 0, borderRadius: 6, cursor: 'pointer', outlineOffset: 2, padding: 0 };
export function CompletedFilterButton({ wide = true, useCompletedFilter, setCompletedFilterEnabled, t }) {
  const enabled = useCompletedFilter(state => state.enabled);
  return createElement('button', { type: 'button', 'aria-label': t('toggle'), 'aria-pressed': enabled,
    title: t(enabled ? 'disableTooltip' : 'enableTooltip'), onClick: () => setCompletedFilterEnabled(!enabled),
    style: { ...buttonStyle, width: wide ? 28 : 36, height: wide ? 28 : 36,
      color: enabled ? 'var(--dsw-alias-state-business-primary, #3485ed)' : 'var(--dsw-alias-label-secondary, currentColor)',
      background: enabled ? 'var(--dsw-alias-interactive-bg-hover, rgba(52,133,237,.12))' : 'transparent' } },
    createElement('svg', { width: 17, height: 17, viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': true },
      createElement('circle', { cx: 10, cy: 10, r: 7.2, stroke: 'currentColor', strokeWidth: 1.5 }),
      createElement('path', { d: 'm6.2 10 2.4 2.5 5.2-5.3', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' })));
}
export function CompletedFilterStatus({ active, visibleCount, pendingCount = 0, unknownCount = 0,
  useCompletedFilter, setCompletedFilterEnabled, retryCompletedFilter, unavailable = false, t }) {
  if (unavailable) return createElement('div', { role: 'status', style: { padding: '8px 12px', fontSize: 12 } }, t('unavailable'));
  const enabled = useCompletedFilter(state => state.enabled);
  if (!enabled || !active || visibleCount > 0 && pendingCount === 0 && unknownCount === 0) return null;
  const rows = [];
  if (pendingCount > 0) rows.push(createElement('div', { key: 'pending' }, t('loading', { count: pendingCount })));
  if (unknownCount > 0) rows.push(createElement('div', { key: 'unknown' }, t('unknown', { count: unknownCount })));
  if (visibleCount === 0 && pendingCount === 0) rows.push(createElement('div', { key: 'empty' }, t('empty')));
  rows.push(createElement('button', { key: 'clear', type: 'button', onClick: () => setCompletedFilterEnabled(false),
    style: { marginTop: 6, cursor: 'pointer' } }, t('clear')));
  if (unknownCount > 0) rows.push(createElement('button', { key: 'retry', type: 'button', onClick: retryCompletedFilter,
    style: { marginTop: 6, marginLeft: 6, cursor: 'pointer' } }, t('retry')));
  return createElement('div', { role: 'status', 'aria-live': 'polite',
    style: { padding: '8px 12px', fontSize: 12, color: 'var(--dsw-alias-label-secondary, currentColor)' } }, ...rows);
}
export function applyCompletedSidebar(ctx) {
  ctx.effect(() => ctx.locale.register(SIDEBAR_NAMESPACE, sidebarMessages), 'session alerts: sidebar dictionaries');
  const api = ctx.uiWorkspace.sessionFilters;
  if (api?.apiVersion !== 1 || typeof api.register !== 'function') {
    ctx.logger?.warn?.('DSH Session Alerts: completed-session workspace API unavailable; no fake toggle mounted.');
    ctx.slots.inject('sidebar.workspaces.filter.status', () => ctx.slots.register({
      name: 'sidebar.workspaces.filter.status', id: `${FILTER_ID}.unavailable`, locale: SIDEBAR_NAMESPACE,
      inject: () => ({ unavailable: true }),
    }, CompletedFilterStatus));
    return;
  }
  ctx.effect(() => {
    const model = createCompletedFilter({ sessions: ctx.sessions.list, statuses: ctx.uiSession.sessionStatus,
      generation: ctx.connection.generation, classify: createCompletionReader(ctx.remote) });
    let removeFilter, removeHeader, removeStatus;
    try {
      removeFilter = api.register({ id: FILTER_ID, source: model.source });
      const injected = () => ({ hooks: { completedFilter: model.source },
        setCompletedFilterEnabled: value => model.setEnabled(value), retryCompletedFilter: () => model.refresh() });
      removeHeader = ctx.slots.inject('sidebar.workspaces.header.action', () => ctx.slots.register({
        name: 'sidebar.workspaces.header.action', id: FILTER_ID, order: 50, locale: SIDEBAR_NAMESPACE, inject: injected,
      }, CompletedFilterButton));
      removeStatus = ctx.slots.inject('sidebar.workspaces.filter.status', () => ctx.slots.register({
        name: 'sidebar.workspaces.filter.status', id: FILTER_ID, order: 50, locale: SIDEBAR_NAMESPACE, inject: injected,
      }, CompletedFilterStatus));
    } catch (error) { model.dispose(); removeFilter?.(); removeHeader?.(); removeStatus?.(); throw error; }
    return () => { model.dispose(); removeHeader?.(); removeStatus?.(); removeFilter?.(); };
  }, 'session alerts: independent completed-session sidebar');
}
