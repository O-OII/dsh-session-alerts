/** Standalone sidebar contribution; deliberately has no native-read marker. */
import { applyUnreadSidebar } from './completed-sidebar.mjs';
export const name = 'dsh-session-alerts-sidebar-client';
export const inject = ['slots','sessions','uiSession','connection','remote','remote.session','locale','uiWorkspace'];
export function apply(ctx) { applyUnreadSidebar(ctx); }
