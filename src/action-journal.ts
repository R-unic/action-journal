import Signal from "@rbxts/lemon-signal";

import { StateManager } from "./state-manager";
import type { Action } from "./structs";

const { clamp } = math;
const DEFAULT_FILTER_MODE = FilterMode.Any;
const DEFAULT_HISTORY_SIZE = 100;

export type ActionFilter<State extends {}, Path extends string = string> =
  (action: Action<State, Path>) => boolean;

export const enum JournalMode {
  Record,
  Sync
}

export const enum FilterMode {
  Any,
  All
}

export interface ActionJournalOptions {
  readonly mode: JournalMode;
  readonly filterMode?: FilterMode;
  readonly historySize?: number;
}

export class ActionJournal<State extends {}> {
  public readonly added = new Signal<(action: Action<State>) => void>;

  private readonly actions: Action<State>[] = [];
  private readonly undoQueue: Action<State>[] = [];
  private readonly filters = new Set<ActionFilter<State>>;

  public constructor(
    private readonly state: StateManager<State>,
    private readonly options: ActionJournalOptions
  ) {
    switch (options.mode) {
      case JournalMode.Record: {
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
      case JournalMode.Sync: {
        this.added.Connect((action) => this.executeAction(action));
        break;
      }
    }
  }

  public addFilter(filter: ActionFilter<State>): this {
    this.filters.add(filter);
    return this;
  }

  public removeFilter(filter: ActionFilter<State>): this {
    this.filters.delete(filter);
    return this;
  }

  public isFiltered(action: Action<State>, filterMode = DEFAULT_FILTER_MODE): boolean {
    const filterResults = [...this.filters].map(filter => filter(action));
    switch (filterMode) {
      case FilterMode.Any:
        return filterResults.some(v => v);
      case FilterMode.All:
        return filterResults.every(v => v);
    }
  }

  public add(action: Action<State>, filterMode = DEFAULT_FILTER_MODE): this {
    if (this.isFiltered(action, filterMode)) return this;

    const { historySize = DEFAULT_HISTORY_SIZE } = this.options;
    const { actions } = this;
    if (actions.size() >= historySize) {
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
    return this;
  }

  /** **Note:** This function does not mutate the current state or `ActionJournal` at all. Setting `managed` to `true` will return a (new) `StateManager` instead of a `State` object. */
  public getStateAt(timestamp: number, managed: true): StateManager<State>;
  public getStateAt(timestamp: number, managed?: false): State;
  public getStateAt(timestamp: number, managed?: boolean): State | StateManager<State> {
    this.validateTimestamp(timestamp);
    const state = new StateManager<State>(this.state.initial);
    const actions = new ActionJournal(state, { mode: JournalMode.Sync });
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

    this.validateTimestamp(timestamp);
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

  public redo(): this {
    const action = this.undoQueue.pop();
    if (!action) return this;

    return this.executeAction(action);
  }

  public undoNewerThan(timestamp: number): this {
    for (const i of $range(this.actions.size() - 1, 0, -1)) {
      const action = this.actions[i];
      if (action.timestamp < timestamp) continue;
      this.undoDirect(action);
    }
    return this;
  }

  public undoToAction(action: Action<State>): this {
    return this.undoNewerThan(action.timestamp);
  }

  public undo(): this {
    const action = this.actions.pop();
    if (!action) return this;

    this.undoDirect(action);
    return this;
  }

  public executeAction(action: Action<State>, author = action.author, history = true): this {
    this.state.setPath(action.target, action.newValue as never, author, undefined, history);
    return this;
  }

  private undoDirect(action: Action<State>): void {
    this.state.setPath(action.target, action.oldValue as never, action.author, undefined, false);
    this.undoQueue.push(action);
  }

  private validateTimestamp(timestamp: number): void {
    const oldest = this.getFirst();
    const newest = this.getLast();
    const invalid = oldest !== undefined
      && newest !== undefined
      && (timestamp < oldest.timestamp || newest && timestamp > newest.timestamp);

    if (invalid) {
      error("Invalid timestamp: " + timestamp, 2);
    }
  }
}