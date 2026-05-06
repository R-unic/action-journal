import { Assert, Fact } from "@rbxts/runit";
import { JournalMode, FilterMode, ActionJournal, StateManager, type Action, type ActionFilter } from "@rbxts/action-journal";

import { TEST_STATE, type TestState } from "./common";

class ActionJournalTest {
  @Fact
  public syncsActions(): void {
    const state = new StateManager<TestState>(TEST_STATE);
    const actions = new ActionJournal(state, { mode: JournalMode.Sync });
    const actionQueue: Action<TestState>[] = [
      {
        timestamp: 0,
        target: "foo/bar/baz",
        author: "syncer",
        oldValue: 69,
        newValue: 420
      }, {
        timestamp: 1,
        target: "foo/bar/baz",
        author: "syncer",
        oldValue: 420,
        newValue: 1337
      }
    ];

    for (const action of actionQueue) {
      actions.add(action);
    }

    Assert.count(2, actions.getRecorded());
    Assert.equal(1337, state.getPath("foo/bar/baz"));
  }

  @Fact
  public recordsActions(): void {
    const state = new StateManager<TestState>(TEST_STATE);
    const actions = new ActionJournal(state, { mode: JournalMode.Record });
    state.setPath("foo/bar/baz", 420, "test");
    state.setPath("foo/bar/baz", 1337, "test");
    Assert.equal(1337, state.getPath("foo/bar/baz"));

    const recorded = actions.getRecorded();
    Assert.count(2, recorded);

    const [firstChange, secondChange] = recorded;
    Assert.true(firstChange.timestamp < secondChange.timestamp);
    Assert.equal("test", firstChange.author);
    Assert.equal("test", secondChange.author);
    Assert.equal("foo/bar/baz", firstChange.target);
    Assert.equal("foo/bar/baz", secondChange.target);
    Assert.equal(TEST_STATE.foo.bar.baz, firstChange.oldValue);
    Assert.equal(420, firstChange.newValue);
    Assert.equal(420, secondChange.oldValue);
    Assert.equal(1337, secondChange.newValue);
  }

  @Fact
  public isFiltered(): void {
    const state = new StateManager<TestState>(TEST_STATE);
    const actions = new ActionJournal(state, { mode: JournalMode.Record, filterMode: FilterMode.Any });
    const fooFilter: ActionFilter<TestState> = ({ author }) => author === "foo";
    actions.addFilter(fooFilter);

    const action: Action<TestState> = {
      timestamp: 0,
      target: "foo/bar/baz",
      author: "test",
      oldValue: 69,
      newValue: 420
    };
    const fooAction: Action<TestState> = {
      timestamp: 1,
      target: "foo/bar/baz",
      author: "foo",
      oldValue: 420,
      newValue: 1337
    };

    Assert.false(actions.isFiltered(action));
    Assert.true(actions.isFiltered(fooAction));
  }

  @Fact
  public filtersActions_modeAny(): void {
    const state = new StateManager<TestState>(TEST_STATE);
    const actions = new ActionJournal(state, { mode: JournalMode.Record, filterMode: FilterMode.Any });
    const fooFilter: ActionFilter<TestState> = ({ author }) => author === "foo";
    const barFilter: ActionFilter<TestState> = ({ author }) => author === "bar";
    actions.addFilter(fooFilter).addFilter(barFilter);

    state.setPath("foo/bar/baz", 420, "foo");
    state.setPath("foo/bar/baz", 420, "bar");
    state.setPath("foo/bar/baz", 420, "baz");
    const recorded = actions.getRecorded();
    Assert.single(recorded);

    const [recordedAction] = recorded;
    Assert.equal("baz", recordedAction.author);
    Assert.equal(420, recordedAction.newValue);

    actions.removeFilter(fooFilter);
    actions.removeFilter(barFilter);
    state.setPath("foo/bar/baz", 1337, "foo");
    state.setPath("foo/bar/baz", 69, "bar");
    const newRecorded = actions.getRecorded();
    Assert.count(3, newRecorded);
  }

  @Fact
  public filtersActions_modeAll(): void {
    const state = new StateManager<TestState>(TEST_STATE);
    const actions = new ActionJournal(state, { mode: JournalMode.Record, filterMode: FilterMode.All });
    const fooFilter: ActionFilter<TestState> = ({ author }) => author === "foo";
    const weedFilter: ActionFilter<TestState> = ({ newValue }) => typeIs(newValue, "number") && newValue > 420;
    actions.addFilter(fooFilter);
    actions.addFilter(weedFilter);

    state.setPath("foo/bar/baz", 1337, "foo");
    state.setPath("foo/bar/baz", 420, "foo");
    const recorded = actions.getRecorded();
    Assert.single(recorded);

    const [recordedAction] = recorded;
    Assert.equal(420, recordedAction.newValue);

    actions.removeFilter(fooFilter);
    actions.removeFilter(weedFilter);
    state.setPath("foo/bar/baz", 1337, "foo");
    const newRecorded = actions.getRecorded();
    Assert.single(newRecorded);
  }

  @Fact
  public cyclicHistory(): void {
    const state = new StateManager<TestState>(TEST_STATE);
    const actions = new ActionJournal(state, { mode: JournalMode.Record, historySize: 2 });
    state.setPath("foo/bar/baz", 420, "test");
    state.setPath("foo/bar/baz", 1337, "test");
    state.setPath("foo/bar/baz", 67, "test");
    Assert.equal(67, state.getPath("foo/bar/baz"));

    const recorded = actions.getRecorded();
    Assert.count(2, recorded);

    const [firstChange, secondChange] = recorded;
    Assert.true(firstChange.timestamp < secondChange.timestamp);
    Assert.equal("test", firstChange.author);
    Assert.equal("test", secondChange.author);
    Assert.equal("foo/bar/baz", firstChange.target);
    Assert.equal("foo/bar/baz", secondChange.target);
    Assert.equal(420, firstChange.oldValue);
    Assert.equal(1337, firstChange.newValue);
    Assert.equal(1337, secondChange.oldValue);
    Assert.equal(67, secondChange.newValue);
  }

  @Fact
  public undoAction_redoAction(): void {
    const state = new StateManager<TestState>(TEST_STATE);
    const actions = new ActionJournal(state, { mode: JournalMode.Record });
    state.setPath("foo/bar/baz", 420, "test");
    Assert.equal(420, state.getPath("foo/bar/baz"));

    actions.undo();
    Assert.equal(69, state.getPath("foo/bar/baz"));

    actions.redo();
    Assert.equal(420, state.getPath("foo/bar/baz"));
  }

  @Fact
  public undoToAction(): void {
    const state = new StateManager<TestState>(TEST_STATE);
    const actions = new ActionJournal(state, { mode: JournalMode.Record });
    state.setPath("foo/bar/baz", 420, "test");
    state.setPath("foo/bar/baz", 1337, "test");
    state.setPath("foo/bar/baz", 67, "test");
    Assert.equal(67, state.getPath("foo/bar/baz"));

    const last = actions.getLast(2);
    Assert.defined(last);

    actions.undoToAction(last);
    Assert.equal(69, state.getPath("foo/bar/baz"));
  }

  @Fact
  public invalidTimestampThrows(): void {
    const state = new StateManager<TestState>(TEST_STATE);
    const actions = new ActionJournal(state, { mode: JournalMode.Record });
    state.setPath("foo/bar/baz", 69420, "test");

    Assert.throws(() => actions.timeTravel(-1), "Invalid timestamp: -1");
    Assert.throws(() => actions.timeTravel(1e10), "Invalid timestamp: 10000000000");
    Assert.throws(() => actions.getStateAt(-1), "Invalid timestamp: -1");
    Assert.throws(() => actions.getStateAt(1e10), "Invalid timestamp: 10000000000");
  }

  @Fact
  public timeTravel(): void {
    const state = new StateManager<TestState>(TEST_STATE);
    const actions = new ActionJournal(state, { mode: JournalMode.Record });
    state.setPath("foo/bar/baz", 420, "test");

    const timestamp = os.clock();
    state.setPath("foo/bar/baz", 1337, "test");
    state.setPath("foo/bar/baz", 67, "test");
    actions.undo();

    Assert.equal(1337, state.getPath("foo/bar/baz"));

    const recorded = actions.getRecorded();
    const undoQueue = actions.getUndoQueue();
    Assert.count(2, recorded);
    Assert.single(undoQueue);

    actions.timeTravel(timestamp);

    const newRecorded = actions.getRecorded();
    const newUndoQueue = actions.getUndoQueue();
    Assert.single(newRecorded);
    Assert.empty(newUndoQueue);
    Assert.equal(420, state.getPath("foo/bar/baz"));
  }

  @Fact
  public getStateAt(): void {
    const state = new StateManager<TestState>(TEST_STATE);
    const actions = new ActionJournal(state, { mode: JournalMode.Record });
    state.setPath("foo/bar/baz", 420, "test");

    const timestamp = os.clock();
    state.setPath("foo/bar/baz", 1337, "test");
    state.setPath("foo/bar/baz", 67, "test");
    Assert.equal(67, state.getPath("foo/bar/baz"));

    const rawStateBefore = actions.getStateAt(timestamp);
    Assert.equal(420, rawStateBefore.foo.bar.baz);

    const stateBefore = actions.getStateAt(timestamp, true);
    Assert.equal(420, stateBefore.getPath("foo/bar/baz"));
  }

  @Fact
  public getFirst(): void {
    const state = new StateManager<TestState>(TEST_STATE);
    const actions = new ActionJournal(state, { mode: JournalMode.Record });
    state.setPath("foo/bar/baz", 420, "test");
    state.setPath("foo/bar/baz", 1337, "test");
    state.setPath("foo/bar/baz", 67, "test");

    const first = actions.getFirst();
    const second = actions.getFirst(1);
    const last = actions.getFirst(2);
    Assert.defined(first);
    Assert.equal(420, first.newValue);
    Assert.defined(second);
    Assert.equal(1337, second.newValue);
    Assert.defined(last);
    Assert.equal(67, last.newValue);
  }

  @Fact
  public getLast(): void {
    const state = new StateManager<TestState>(TEST_STATE);
    const actions = new ActionJournal(state, { mode: JournalMode.Record });
    state.setPath("foo/bar/baz", 420, "test");
    state.setPath("foo/bar/baz", 1337, "test");
    state.setPath("foo/bar/baz", 67, "test");

    const last = actions.getLast();
    const second = actions.getLast(1);
    const first = actions.getLast(2);
    Assert.defined(first);
    Assert.equal(420, first.newValue);
    Assert.defined(second);
    Assert.equal(1337, second.newValue);
    Assert.defined(last);
    Assert.equal(67, last.newValue);
  }
}

export = ActionJournalTest;