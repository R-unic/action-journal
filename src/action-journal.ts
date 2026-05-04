import Signal from "@rbxts/lemon-signal";

import type { StateManager } from "./state-manager";
import type { Action } from "./structs";

const { clamp } = math;

export const enum ActionJournalMode {
  Record,
  Sync
}

export class ActionJournal<State extends {}> {
  public readonly added = new Signal<(action: Action<State>) => void>;

  private readonly actions: Action<State>[] = [];
  private readonly undoQueue: Action<State>[] = [];

  public constructor(
    mode: ActionJournalMode,
    private readonly state: StateManager<State>,
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

  public add(action: Action<State>): void {
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

  public executeAction(action: Action<State>, author = action.author): void {
    this.state.setPath(action.target, action.newValue as never, author);
  }

  private undoDirect(action: Action<State>): void {
    this.state.setPath(action.target, action.oldValue as never, action.author, undefined, false);
    this.undoQueue.push(action);
  }
}