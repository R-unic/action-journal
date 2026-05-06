# @rbxts/action-journal

[![CI Status](https://github.com/R-unic/action-journal/actions/workflows/test.yml/badge.svg)](https://github.com/R-unic/action-journal/actions/workflows)
[![Coverage Status](https://coveralls.io/repos/github/R-unic/action-journal/badge.svg?branch=master)](https://coveralls.io/github/R-unic/action-journal)

A powerful state management library for Roblox with undo/redo capabilities, action recording, and time-travel debugging.

## Features

- 🎯 **Type-safe** - Full TypeScript support with path-based type inference
- 📝 **Action Recording** - Automatically records all state changes
- 🔄 **Action Replay** - Execute recorded actions on a state manager
- 🔍 **Action Filtering** - Apply action filters for actions undesirable to record/sync
- 🎨 **Path-based Updates** - Update nested state using simple path strings
- ⏪ **Undo/Redo** - Full undo/redo support with separate action queue
- 🕒 **Time Travel (Mutating)** - Reset action journal to any point in history, erasing future actions/undos
- 📸 **Time Travel (Non-mutating)** - Inspect state at any historical timestamp without affecting current state
- 📊 **History Pruning** - Configurable history size limits
- ⚡ **Lightweight** - Just one dependency (Lemon Signal)
- 🔒 **Immutability** - State is processed immutably for predictable behavior

## Quick Start

```ts
import { StateManager, ActionJournal, JournalMode } from "@rbxts/action-journal";

// all data is immutable
interface GameState {
  readonly player: {
    readonly health: number;
    readonly position: {
      readonly x: number;
      readonly y: number;
    };
    readonly inventory: string[];
  };
  readonly score: number;
}

const state = new StateManager<GameState>({
  player: {
    health: 100,
    position: { x: 0, y: 0 },
    inventory: []
  },
  score: 0
});

const actions = new ActionJournal(state, { mode: JournalMode.Record });
state.setPath("player/health", 80, "damage_system"); // each state change requires an author
state.setPath("score", 100, "score_system");
state.setPath("player/position/x", 10, "position_system");

actions.undo(); // player/position/x reverts to 0
       .redo(); // player/position/x returns to 10
```

## Syncing Client/Server State

**Note:** This is **not** a two-way sync. I do not recommend a two-way sync regardless, as state changes from the client should come in the form of domain-specific requests to the server (such as "craft recipe" where the server consumes ingredients and adds the result).

```ts
// shared/state.ts
export const initialState: PlayerState = { speed: 10 };

export interface PlayerState {
  readonly speed: number;
}

// server/state.ts
import { StateManager, ActionJournal, JournalMode } from "@rbxts/action-journal";

import { initialState, type PlayerState } from "shared/state";

const playerStates = new Map<Player, PlayerState>();
Players.PlayerAdded.Connect(player => {
  const state = new StateManager<PlayerState>(initialState);
  const actions = new ActionJournal(state, { mode: JournalMode.Record });
  actions.added.Connect(action => messaging.client.emit(player, Message.SyncAction, action)); // your networking library - tether as an example

  playerStates.set(player, state);
});

messaging.server.on(Message.SpeedBoost, player => {
  const state = playerStates.get(player);
  if (!state) return;

  state.setPath("speed", 69, "speed-boost");
});

// client/state.ts

import { StateManager, ActionJournal, JournalMode } from "@rbxts/action-journal";

import { initialState, type PlayerState } from "shared/state";

const state = new StateManager<PlayerState>(initialState);
const actions = new ActionJournal(state, { mode: JournalMode.Sync });
messaging.client.on(Message.SyncAction, action => actions.add(action));

state.whenPathChanged("speed", ({ author, oldValue, newValue }) => {
  print(author) // speed-boost
  print(oldValue) // 10
  print(newValue) // 69
});
messaging.server.emit(Message.SpeedBoost);
```

## Action Filtering

```ts
import { StateManager, ActionJournal, JournalMode, FilterMode } from "@rbxts/action-journal";

interface State {
  readonly coins: number;
  readonly score: number;
}

const state = new StateManager<State>({ coins: 0, score: 0 });
const actions = new ActionJournal(state, { mode: JournalMode.Record, filterMode: FilterMode.Any }); // this is the default filtering mode
actions.addFilter(action => action.target === "score") // do not record any state changes targeting "score"
       .addFilter(action => action.author === "bar"); // do not record any state changes authored by "bar"

state.setPath("score", 69, "foo");
state.setPath("coins", 100, "foo");
state.setPath("coins", 200, "bar");

print(state.getState()) // { coins = 200, score = 69 }
print(actions.getRecorded().size()) // 1, only recorded the change to 100 coins (not authored by "bar", not changing "score")
```
