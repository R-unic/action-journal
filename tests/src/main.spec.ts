import { Assert, Fact } from "@rbxts/runit";
import { actionEquals, Action, StateManager, ActionJournal } from "@rbxts/action-journal";

import { coverClass, type TestState } from "./common";

class MainTest {
  @Fact
  public coverClasses(): void {
    coverClass(StateManager, "StateManager");
    coverClass(ActionJournal, "ActionJournal");
  }

  @Fact
  public actionEquals(): void {
    const a: Action<TestState> = {
      timestamp: 0,
      target: "foo/bar/baz",
      author: "test",
      oldValue: 69,
      newValue: 420
    };
    const b: Action<TestState> = {
      timestamp: 0,
      target: "foo/bar/baz",
      author: "test",
      oldValue: 69,
      newValue: 420
    };

    Assert.false(a === b); // same shape, different memory
    Assert.true(actionEquals(a, b));
  }
}

export = MainTest