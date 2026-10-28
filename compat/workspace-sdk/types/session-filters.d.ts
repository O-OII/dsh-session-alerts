/** Additive contract for the user-authorized private ui-workspace rc.3 patch.
 * This does not replace the full upstream declaration set, absent from the provided SDK extraction.
 */
export interface SnapshotSource<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
}
export interface SessionFilterContributionSnapshot {
  readonly enabled: boolean;
  readonly matchingSessionIds: ReadonlySet<string>;
  readonly pendingSessionIds?: ReadonlySet<string>;
  readonly unknownSessionIds?: ReadonlySet<string>;
}
export interface SessionFilterSnapshot {
  readonly active: boolean;
  readonly matches: (sessionId: string) => boolean;
  readonly pendingCount: number;
  readonly unknownCount: number;
}
export declare class SessionFiltersRegistry implements SnapshotSource<SessionFilterSnapshot> {
  readonly apiVersion: 1;
  getSnapshot(): SessionFilterSnapshot;
  subscribe(listener: () => void): () => void;
  register(contribution: { id: string; source: SnapshotSource<SessionFilterContributionSnapshot> }): () => void;
  dispose(): void;
}
export declare function filterSessions<T extends { id: string }>(sessions: readonly T[], filters?: SessionFilterSnapshot): readonly T[];
export interface WorkspaceHeaderActionProps {
  readonly wide: boolean;
  readonly searchExpanded: boolean;
}
export interface WorkspaceFilterStatusProps {
  readonly active: boolean;
  /** Native archive visibility + filters, before collapse/watermark; search reports current bounded results. */
  readonly visibleCount: number;
  readonly pendingCount: number;
  readonly unknownCount: number;
}
/** New ctx.uiWorkspace member: sessionFilters: SessionFiltersRegistry.
 * New root/list slots:
 * sidebar.workspaces.header.action: WorkspaceHeaderActionProps (standard hooks/render props still apply)
 * sidebar.workspaces.filter.status: WorkspaceFilterStatusProps
 * New root standard hook: useSessionFilters(selector).
 * Browser-module exports also include workspaceSessionFilterDerivations: a frozen
 * additive namespace of original native pure helpers with optional final filter argument.
 */
