import type { Action, ResolvedOrUnknown } from "./structs";

export { StateManager } from "./state-manager";
export { ActionJournal, ActionJournalMode, type ActionFilter } from "./action-journal";
export type { Action };

export function actionEquals<State extends {}, Path extends string>(
  a: Action<State, Path>,
  b: Action<State, Path>,
  valueEquals = (a: ResolvedOrUnknown<State, Path>, b: ResolvedOrUnknown<State, Path>) => a === b
): boolean {
  return a.timestamp === b.timestamp
    && a.target === b.target
    && a.author === b.author
    && valueEquals(a.oldValue, b.oldValue)
    && valueEquals(a.oldValue, b.oldValue);
}