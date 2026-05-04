# @rbxts/action-journal

A powerful state management library for Roblox with undo/redo capabilities, action recording, and time-travel debugging.

## Features

- 🎯 **Type-safe** - Full TypeScript support with path-based type inference
- ⏪ **Undo/Redo** - Built-in undo/redo functionality with action history
- 📝 **Action Recording** - Automatically records all state changes
- 🔄 **Synchronization** - Sync actions across multiple state managers
- 🎨 **Path-based Updates** - Update nested state using simple path strings
- 🚀 **Lightweight** - Just one dependency, Lemon Signal
- 🔒 **Immutability** - State is processed immutably

## Quick Start

```ts
import { StateManager, ActionJournal, ActionJournalMode } from "@rbxts/action-journal";

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

const stateManager = new StateManager({
  player: {
    health: 100,
    position: { x: 0, y: 0 },
    inventory: []
  },
  score: 0
});

const actions = new ActionJournal(ActionJournalMode.Record, stateManager);
stateManager.setPath("player/health", 80, "damage_system"); // each state change requires an author
stateManager.setPath("score", 100, "score_system");
stateManager.setPath("player/position/x", 10, "position_system");

actions.undo(); // player/position/x reverts to 0
actions.redo(); // player/position/x returns to 10
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
import { StateManager, ActionJournal, ActionJournalMode } from "@rbxts/action-journal";

import { initialState, type PlayerState } from "shared/state";

const playerStates = new Map<Player, PlayerState>();
Players.PlayerAdded.Connect(player => {
  const state = new StateManager<PlayerState>(initialState);
  const actions = new ActionJournal(ActionJournalMode.Record, state);
  actions.added.Connect(action => messaging.client.emit(player, Message.SyncAction, action)); // your networking library - tether as an example

  playerStates.set(player, state);
});

messaging.server.on(Message.SpeedBoost, player => {
  const state = playerStates.get(player);
  if (!state) return;

  state.setPath("speed", 69);
});

// client/state.ts

import { StateManager, ActionJournal, ActionJournalMode } from "@rbxts/action-journal";

import { initialState, type PlayerState } from "shared/state";

const state = new StateManager<PlayerState>(initialState);
const actions = new ActionJournal(ActionJournalMode.Sync, state);
messaging.client.on(Message.SyncAction, action => actions.add(action));

messaging.server.emit(Message.SpeedBoost);
task.wait(1); // wait for server to update state
print(state.getPath("speed")) // 69
```
