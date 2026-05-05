import Signal from "@rbxts/lemon-signal";
import { StateManager } from "./state-manager";
import type { Action } from "./structs";
export type ActionFilter<State extends {}, Path extends string = string> = (action: Action<State, Path>) => boolean;
export declare const enum ActionJournalMode {
    Record = 0,
    Sync = 1
}
export declare const enum ActionFilteringMode {
    Any = 0,
    All = 1
}
export declare class ActionJournal<State extends {}> {
    private readonly state;
    private readonly filteringMode;
    private readonly historySize;
    readonly added: Signal<(action: Action<State>) => void>;
    private readonly actions;
    private readonly undoQueue;
    private readonly filters;
    constructor(mode: ActionJournalMode, state: StateManager<State>, filteringMode?: ActionFilteringMode, historySize?: number);
    addFilter(filter: ActionFilter<State>): void;
    removeFilter(filter: ActionFilter<State>): void;
    isFiltered(action: Action<State>, filteringMode?: ActionFilteringMode): boolean;
    add(action: Action<State>, filteringMode?: ActionFilteringMode): void;
    /** **Note:** This function does not mutate the current state or `ActionJournal` at all. Setting `managed` to `true` will return a (new) `StateManager` instead of a `State` object. */
    getStateAt(timestamp: number, managed: true): StateManager<State>;
    getStateAt(timestamp: number, managed?: false): State;
    /** **Note:** This erases *all* state history (including undo queue!) occurring after `timestamp`. After execution the `ActionJournal` will reflect the current state it was in at `timestamp`. */
    timeTravel(timestamp: number, preserveAuthor?: boolean): void;
    getFirst(offset?: number): Action<State> | undefined;
    getLast(offset?: number): Action<State> | undefined;
    getRecorded(): Action<State>[];
    getUndoQueue(): Action<State>[];
    redo(): void;
    undoNewerThan(timestamp: number): void;
    undoToAction(action: Action<State>): void;
    undo(): void;
    executeAction(action: Action<State>, author?: string, history?: boolean): void;
    private undoDirect;
}
