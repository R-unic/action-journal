import { Assert, Fact } from "@rbxts/runit";
import { ActionJournalMode, ActionJournal, StateManager, type Action, type ActionFilter } from "@rbxts/action-journal";
import { coverClass } from "./utility";

const TEST_STATE = { foo: { bar: { baz: 69 } } };

type TestState = typeof TEST_STATE;

class ActionJournalTest {
  @Fact
  public syncsActions(): void {
    const state = new StateManager<TestState>(TEST_STATE);
    const actions = new ActionJournal(ActionJournalMode.Sync, state);
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
    const actions = new ActionJournal(ActionJournalMode.Record, state);
    coverClass(state, "StateManager");
    coverClass(actions, "ActionJournal");
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
  public filtersRecordedActions(): void {
    const state = new StateManager<TestState>(TEST_STATE);
    const actions = new ActionJournal(ActionJournalMode.Record, state);
    const fooFilter: ActionFilter<TestState> = ({ author }) => author === "foo";
    actions.addFilter(fooFilter);

    state.setPath("foo/bar/baz", 420, "foo");
    const recorded = actions.getRecorded();
    Assert.empty(recorded);

    actions.removeFilter(fooFilter);
    state.setPath("foo/bar/baz", 1337, "foo");
    const newRecorded = actions.getRecorded();
    Assert.single(newRecorded);
  }

  @Fact
  public cyclicHistory(): void {
    const state = new StateManager<TestState>(TEST_STATE);
    const actions = new ActionJournal(ActionJournalMode.Record, state, undefined, 2);
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
    const actions = new ActionJournal(ActionJournalMode.Record, state);
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
    const actions = new ActionJournal(ActionJournalMode.Record, state);
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
  public timeTravel(): void {
    const state = new StateManager<TestState>(TEST_STATE);
    const actions = new ActionJournal(ActionJournalMode.Record, state);
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
    const actions = new ActionJournal(ActionJournalMode.Record, state);
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
    const actions = new ActionJournal(ActionJournalMode.Record, state);
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
    const actions = new ActionJournal(ActionJournalMode.Record, state);
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