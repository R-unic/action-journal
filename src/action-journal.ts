import Signal from "@rbxts/lemon-signal";

import { StateManager } from "./state-manager";
import type { Action } from "./structs";

const { clamp } = math;

export type ActionFilter<State extends {}, Path extends string = string> =
  (action: Action<State, Path>) => boolean;

export const enum ActionJournalMode {
  Record,
  Sync
}

export const enum ActionFilteringMode {
  Any,
  All
}

export class ActionJournal<State extends {}> {
  public readonly added = new Signal<(action: Action<State>) => void>;

  private readonly actions: Action<State>[] = [];
  private readonly undoQueue: Action<State>[] = [];
  private readonly filters = new Set<ActionFilter<State>>;

  public constructor(
    mode: ActionJournalMode,
    private readonly state: StateManager<State>,
    private readonly filteringMode = ActionFilteringMode.Any,
    private readonly historySize = 100
  ) {
    switch (mode) {
      case ActionJournalMode.Record: {
        state.whenChanged(({ author, path, oldValue, newValue }) =>
          this.add({
            timestamp: os.clock(),
            target: path,
            author,
            oldValue: oldValue as never,
            newValue: newValue as never
          })
        );
        break;
      }
      case ActionJournalMode.Sync: {
        this.added.Connect((action) => this.executeAction(action));
        break;
      }
    }
  }

  public addFilter(filter: ActionFilter<State>): void {
    this.filters.add(filter);
  }

  public removeFilter(filter: ActionFilter<State>): void {
    this.filters.delete(filter);
  }

  public isFiltered(action: Action<State>, filteringMode = this.filteringMode): boolean {
    const filterResults = [...this.filters].map(filter => filter(action));
    switch (filteringMode) {
      case ActionFilteringMode.Any:
        return filterResults.some(v => v);
      case ActionFilteringMode.All:
        return filterResults.every(v => v);
    }
  }

  public add(action: Action<State>, filteringMode = this.filteringMode): void {
    if (this.isFiltered(action, filteringMode)) return;

    const { actions } = this;
    if (actions.size() >= this.historySize) {
      const oldest = actions.shift();
      if (oldest) {
        const index = this.undoQueue.indexOf(oldest);
        if (index !== -1) {
          this.undoQueue.remove(index);
        }
      }
    }

    actions.push(action);
    this.added.Fire(action);
  }

  /** **Note:** This function does not mutate the current state or `ActionJournal` at all. Setting `managed` to `true` will return a (new) `StateManager` instead of a `State` object. */
  public getStateAt(timestamp: number, managed: true): StateManager<State>;
  public getStateAt(timestamp: number, managed?: false): State;
  public getStateAt(timestamp: number, managed?: boolean): State | StateManager<State> {
    const state = new StateManager<State>(this.state.initial);
    const actions = new ActionJournal(ActionJournalMode.Sync, state);
    for (const action of this.actions) {
      if (action.timestamp > timestamp) break;
      actions.executeAction(action);
    }

    return managed ? state : state.getState();
  }

  /** **Note:** This erases *all* state history (including undo queue!) occurring after `timestamp`. After execution the `ActionJournal` will reflect the current state it was in at `timestamp`. */
  public timeTravel(timestamp: number, preserveAuthor = true): void {
    const { state, actions, undoQueue } = this;
    const count = actions.size();
    if (count === 0) return;

    const oldest = this.getFirst();
    const newest = this.getLast();
    if ((oldest && timestamp < oldest.timestamp) || (newest && timestamp > newest.timestamp)) {
      return error("Cannot time travel: invalid timestamp")
    }

    const newActions = actions.filter(action => action.timestamp <= timestamp).sort((a, b) => a.timestamp < b.timestamp);
    const newUndoQueue = undoQueue.filter(action => action.timestamp <= timestamp);
    state.setPath("", state.initial, "time-travel");
    actions.clear();
    undoQueue.clear();

    for (const action of newActions) {
      actions.push(action);
      this.executeAction(action, preserveAuthor ? undefined : "time-travel", false);
    }
    for (const action of newUndoQueue) {
      undoQueue.push(action);
    }
  }

  public getFirst(offset = 0): Action<State> | undefined {
    return this.actions[clamp(offset, 0, this.actions.size() - 1)];
  }

  public getLast(offset = 0): Action<State> | undefined {
    const size = this.actions.size();
    return this.actions[size - 1 - clamp(offset, 0, size - 1)];
  }

  public getRecorded(): Action<State>[] {
    return this.actions;
  }

  public getUndoQueue(): Action<State>[] {
    return this.undoQueue;
  }

  public redo(): void {
    const action = this.undoQueue.pop();
    if (!action) return;

    this.executeAction(action);
  }

  public undoNewerThan(timestamp: number): void {
    for (const i of $range(this.actions.size() - 1, 0, -1)) {
      const action = this.actions[i];
      if (action.timestamp < timestamp) continue;
      this.undoDirect(action);
    }
  }

  public undoToAction(action: Action<State>): void {
    this.undoNewerThan(action.timestamp);
  }

  public undo(): void {
    const action = this.actions.pop();
    if (!action) return;

    this.undoDirect(action);
  }

  public executeAction(action: Action<State>, author = action.author, history = true): void {
    this.state.setPath(action.target, action.newValue as never, author, undefined, history);
  }

  private undoDirect(action: Action<State>): void {
    this.state.setPath(action.target, action.oldValue as never, action.author, undefined, false);
    this.undoQueue.push(action);
  }
}