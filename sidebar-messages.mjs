/** Product-owned client dictionaries; technical namespace stays stable. */
export const SIDEBAR_NAMESPACE = 'dsh-native-taskbar-badge.completedFilter';
export const sidebarMessages = {
  zh: {
    toggle: '只看已完成主会话',
    enableTooltip: '只显示DSH实际工作已成功结束的主会话',
    disableTooltip: '关闭只看已完成；保留搜索和其他筛选',
    loading: '正在判定 {count} 个会话的完成状态…',
    unknown: '{count} 个会话尚无可靠完成状态，暂不显示。',
    empty: '暂无符合当前筛选的已完成主会话。',
    clear: '关闭“只看已完成”',
    retry: '重新判定未知状态',
    unavailable: '已完成会话筛选不可用：缺少工作区扩展接口。',
  },
  en: {
    toggle: 'Only completed main sessions',
    enableTooltip: 'Show only main sessions whose consumed DSH work ended successfully',
    disableTooltip: 'Turn off completed-only; keep search and other filters',
    loading: 'Checking completion for {count} sessions…',
    unknown: '{count} sessions have no reliable completion baseline and are excluded.',
    empty: 'No completed main sessions match the current filters.',
    clear: 'Turn off completed-only',
    retry: 'Recheck unknown states',
    unavailable: 'Completed-session filter unavailable: the workspace extension API is missing.',
  },
};
