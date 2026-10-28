/** Independent Host entry: read-only wired completion, never launches Python.
 * It can be added beside an already-running badge engine without replacing it.
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createCompletionDefinition } from './completion-state.mjs';
export const name = 'dsh-session-alerts-completion';
export const inject = ['sessionProjections'];
export async function apply(ctx) {
  const require = createRequire(process.argv[1]);
  const sdk = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-goal')).href);
  ctx.sessionProjections.register(createCompletionDefinition(sdk.goalProjectionDefinition));
}
