# Local native Workspace session-filter SDK patch

User-authorized, **private local-only** frontend artifact for the exact official
`@deepseek-ai/dsh-client-ui-workspace@0.2.1-rc.3` provided with this task. This is not
an official release and must never be published to npm or another registry.

## Deliverable and build

Profile-copyable artifact: [`dist/ui-workspace/`](<dist/ui-workspace/>). The generated
package retains the official name, version, host `main`, complete `exports`, and
original `dsh.client` manifest/inject list. `private: true` and explicit local-patch
metadata distinguish it. The Host entry is the **byte-identical original no-op**.
The client retains module id `@deepseek-ai/dsh-client-ui-workspace` so existing
client-graph consumers resolve the same identity. There is no replacement server.

From this builder directory:

```powershell
node scripts/build.mjs
node --test test/sdk.test.mjs
```

The builder uses its bundled `vendor/ui-workspace` baseline by default, so the
whole compatibility project can move to another directory or OS without referring
to this workspace. It optionally takes one explicit input package directory argument.
Building uses only Node built-ins and requires no dependency installation. It accepts
only these exact SHA256 pins, rejects unknown input before writing any output,
and applies 45 literal edits whose occurrence counts must match exactly:

| Official input | SHA256 |
|---|---|
| client bundle | `bafd2d6eea2f82674cc0606bec13fc891e44b42fb2ac973f01cb32c735d4062f` |
| package metadata | `249106ef05cd599e1a9d04d4443529f30e8d8aa914d7feee59357b5d052fc523` |
| Host entry | `e6cdc4b725585354102a5c4598c9d8c79d6abac62d7979c09919821716370438` |

Exact changes, including every before/after literal, and the generated output
hash are in [`AUDIT.json`](<dist/ui-workspace/AUDIT.json>). Original input evidence
is retained under [`vendor/ui-workspace/`](<vendor/ui-workspace/>), separated
from distribution. With explicit user authorization, this MIT-licensed baseline
may be checked into the plugin repository's isolated `compat/workspace-sdk`
engineering directory for auditable/reproducible builds; it is not normal plugin
runtime code and must be excluded from the main plugin's npm package. No download, install, publication, ASAR modification, or live
configuration change is performed. The upstream MIT license and provenance are
included in [`LICENSE`](<legal/LICENSE>) and [`NOTICE`](<legal/NOTICE>).

## Public API v1

```ts
ctx.uiWorkspace.sessionFilters.apiVersion === 1
const dispose = ctx.uiWorkspace.sessionFilters.register({
  id: 'my-plugin.alert-filter',
  source: {
    getSnapshot: () => snapshot,
    subscribe: listener => { /* subscribe */; return unsubscribe },
  },
})
```

Contribution snapshots are immutable, identity-stable SnapshotSource values:

```ts
{
  enabled: boolean,
  matchingSessionIds: ReadonlySet<string>,
  pendingSessionIds?: ReadonlySet<string>,
  unknownSessionIds?: ReadonlySet<string>,
}
```

Publish a **new snapshot object** when any value changes. In-place mutation is
unsupported; copied Sets ensure it cannot mutate an already published aggregate.
`register` rejects duplicate/nonempty-invalid ids and invalid sources. Each source
has one immediate subscription until contribution disposal or registry disposal.
The owner must return the registration disposer from its Cordis effect.
Disposers are idempotent. Provider unload disposes every source subscription.

The registry itself is a SnapshotSource with stable `getSnapshot` / `subscribe`
functions and an immutable snapshot:

```ts
{ active: boolean, matches: (id: string) => boolean,
  pendingCount: number, unknownCount: number }
```

All enabled contributions are combined with **AND**. A Session must be in every
enabled matching set and absent from every enabled pending/unknown set. Pending
and unknown counts are deduplicated unions across enabled contributions, not
restricted by native query/archive visibility. With none enabled, `matches`
returns true and the original inactive singleton is restored. Source emissions
that keep snapshot identity are no-ops. Old aggregate snapshots remain immutable.

A root standard hook `useSessionFilters(selector)` projects this registry. It is
injected through the native slot system, not a private store or DOM mutation.

### Native root/list extension seats

- `sidebar.workspaces.header.action`, runtime props `{wide, searchExpanded}`:
  genuine child seat inside native `headerActions`, before View options and Add
  workspace. Both booleans are the native owner's actual render state; consumers
  must not infer rail/wide layout from missing values.
- `sidebar.workspaces.filter.status`, runtime props
  `{active, visibleCount, pendingCount, unknownCount}`: native body status seat,
  rendered while a contribution is enabled.

Register contributions with the official `ctx.slots.inject(name, ...)` lifecycle.
Both seats are `kind: 'list', scope: 'root'`; no Session is retained to mount them.
The header seat is wide-sidebar-only. When occupied, its controls remain visible
while native search is open. The old 60px cap becomes a shrinkable 60%-of-header
cap; native no-extension search still collapses its actions as before. Keep each
contributed header control compact and accessible (icon button / portal menu).

`visibleCount` includes native archive visibility + filter matches, before folded
group visibility and watermark limits. In search it is the currently rendered
bounded result count. Pending/unknown counts remain contribution-global.
Native localized English/Chinese filtered-empty fallback is always available,
even with no status-seat contribution. With zero matching rows, pendingCount > 0
shows **Checking session status… / 正在检查会话状态…**; otherwise unknownCount > 0
shows **No confirmed matching sessions ({n} undetermined) /
暂无可确认符合条件的会话（{n} 个未判定）**. Only a resolved empty set shows the
ordinary no-match message. This priority also applies to native search once its
own Host search request settles. A plugin's status seat may add counts, progress
and a Reset action without contradicting the fallback.

### Presentation and accounting boundaries

The original `sessionVisible` predicate receives an optional aggregate, applied
only in grouped, flat and search **row derivation**. Full Session lists, Workspace
membership, pinned partitions, complete saved orders, hidden archive accounting,
and drag/order actions are not filtered or rewritten. Grouped rows are filtered
**before** watermark limiting; search rows are filtered before its final slice.
Groups without matching members are omitted while active; the original full
parent map is retained and native nearest-visible-ancestor logic handles tree
presentation. No filter-triggered auto-expansion, account writes or navigation
is added. Native own current-session expansion behavior is unchanged.

Filtering out the current Session hides only its sidebar row. Main selection,
retention, composer and conversation are unchanged. Reset/unload restores native
rows and no-filter reference identity in the additive `filterSessions` helper.

**Native search remains flat**, including when Workspace Tree is selected.
Host search requests and Host result-page limits are unchanged: local filtering
cannot discover content-only matches beyond the page the Host returned. This is
the original native content-search page ceiling, **not a new filter omission bug**.
Native `hasMore` remains a refine-query hint, not a count of unseen filter matches.

### Additive exports/types

The generated browser module additionally exports `SessionFiltersRegistry`,
`filterSessions`, and frozen `workspaceSessionFilterDerivations` containing the
actual native pure helpers `deriveGroups`, `deriveFlat`, `deriveSearchResults`,
`watermarkRows`, `sessionDragOrder`, `sessionMemberIds`, `owningParentFolder`.
The first three accept an optional final aggregate argument. These permit tests
to exercise actual generated code rather than a reimplementation.

[`SESSION_FILTERS.d.ts`](<dist/ui-workspace/SESSION_FILTERS.d.ts>) documents the
additive API. The supplied official extraction omitted its entire original
`lib/types` tree; original type export paths are retained unchanged, **not**
misrepresented as a new complete declaration set. The live runtime needs only
the preserved JavaScript entries. Consumers can use the additive contract file
or their existing original SDK type source. The only checked-in original SDK
copy permitted by this task is the explicitly authorized MIT baseline inside
the isolated compatibility engineering project described above; never bundle it
into the separate normal plugin runtime.

## Verification

15 tests load the actual generated ModuleLoader factory using its unchanged
external dependency names. Tests cover registry immutability, AND composition,
unknown/pending exclusion, duplicate rejection, source-subscription races,
reset/disposal/unload, pin/archive accounting, full-order drag membership,
filter-before-watermark for rows beyond six, query/content search filter-before-
cap, and main-view retention. A real React 18 server-render fixture exercises the
native Browser with both seats and filtered empty states. All three grouping
modes × all three archive modes produce **byte-identical upstream HTML** when
no extension/filter is active. Native search is mounted open using a fixture-only
adapter of React's public `useState` API; header retention and flat results are
asserted. The production bundle and private React stores are not monkeypatched.

Tests resolve React/ReactDOM from this compatibility project's declared exact
`devDependencies` (`react@18.3.1`, `react-dom@18.3.1`). A developer can prepare them
with their package manager (for example `npm install --ignore-scripts`) and then
run `npm run build` / `npm test`. Alternatively, for an offline check without
installation, explicitly set `DSH_SDK_TEST_REACT_ROOT` to an existing node_modules
directory containing those versions; there is no hardcoded other-repository
fallback. No installation was performed for this task, and test dependencies are
never copied into distribution. Source releases should include this project's
src/scripts/types/legal/test/package/README and MIT vendor baseline, but exclude
dist/artifacts/node_modules from the main plugin package.

SSR is not browser layout/interaction proof. Parent owns final current-GUI tests:
header width at the user's actual sidebar size, open/close search, view-mode
changes, >6 live rows, Reset, contribution unload and current composer continuity.

## Deployment boundary — parent only

No deployment was performed by this SDK builder. Copy the entire generated
package folder to a profile-local source location. DSH's official entry-patch
`name` field is a **source assertion**, not a rename operation: do not overwrite
the official ui-workspace entry's name with a local path. That fails the official
patch assertion and does not substitute the source.

Use the official profile-local patch mechanism in two explicit steps:

1. Disable the original ui-workspace Loader entry while keeping its official
   `name` assertion unchanged. Reconcile and confirm the old active source has
   unloaded before enabling the replacement.
2. Insert a **separate Loader entry id**, for example
   `session-alerts-workspace-sdk`, whose `name` is the absolute file URL of the
   private package's unchanged Host `lib/index.js`. Reconcile that new entry.
   Its package/client module identity intentionally remains the official
   `@deepseek-ai/dsh-client-ui-workspace`; the Loader entry id is distinct.

Never leave both sources active concurrently. Back up the exact original profile
patch/configuration before starting. On rollback, stop/remove only the inserted
local entry and restore the original entry's prior active state/configuration.
The parent deployment helper owns locking, backups, ordered source reconciliation
and rollback. A failed early staging attempt must leave the original source
restored; it is not evidence that the patched client activated.

Refresh the **existing** GUI URL, not a replacement server. If Loader/source
reconciliation cannot activate this without a **Host restart**, stop and tell the
user; a Host restart is outside this task's approval. Parent must verify actual
loader metadata/module graph and fresh current-GUI behavior before claiming live
success.
