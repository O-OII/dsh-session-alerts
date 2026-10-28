/** Shared JSON contract; no SDK, platform, storage or Python dependency. */
export const COMPLETION_KEY = 'sessionAlertsCompletion';
export const COMPLETION_STATES = new Set(['completed','running','waiting','error','incomplete','unknown']);
export const GOAL_PHASES = new Set(['none','active','paused','blocked','complete']);
export function parseCompletionView(value) {
  const integer = number => Number.isSafeInteger(number) && number >= 0;
  if (!value || value.version !== 1 || !COMPLETION_STATES.has(value.state) || typeof value.main !== 'boolean' ||
      (value.turn !== null && !integer(value.turn)) || (value.eventSeq !== null && !integer(value.eventSeq)) ||
      !GOAL_PHASES.has(value.goalPhaseAtEnd) || (value.goalIdAtEnd !== null && typeof value.goalIdAtEnd !== 'string') ||
      typeof value.droppedUnrun !== 'boolean') throw new TypeError('Invalid session completion projection');
  if (value.state === 'completed' && (!value.main || value.droppedUnrun || value.turn === null || value.eventSeq === null ||
      !['none','complete'].includes(value.goalPhaseAtEnd) || value.goalPhaseAtEnd === 'none' && value.goalIdAtEnd !== null ||
      value.goalPhaseAtEnd === 'complete' && !value.goalIdAtEnd)) throw new TypeError('Inconsistent completed projection');
  return value;
}
