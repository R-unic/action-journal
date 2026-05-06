import { Assert, Fact } from "@rbxts/runit";
import { StateManager } from "@rbxts/action-journal";

import { TEST_STATE } from "./common";

class StateManagerTest {
  @Fact
  public invalidPath(): void {
    const state = new StateManager(TEST_STATE);
    Assert.throws(() => state.getPath("sigma/balls"), "Invalid path: sigma/balls");
    Assert.throws(() => state.setPath("sigma/balls", 69 as never, "test"), "Invalid path: sigma/balls");
  }

  @Fact
  public initial(): void {
    const state = new StateManager(TEST_STATE);
    state.setPath("foo/bar/baz", 420, "test");
    state.setPath("foo/bar/baz", 67, "test");
    state.setPath("foo/bar/baz", 1337, "test");
    Assert.equal(69, state.initial.foo.bar.baz);
  }

  @Fact
  public getState(): void {
    const state = new StateManager(TEST_STATE);
    const data = state.getState();
    Assert.true("foo" in data);
    Assert.true("bar" in data.foo);
    Assert.true("baz" in data.foo.bar);
    Assert.equal(69, data.foo.bar.baz);
  }

  @Fact
  public getPath(): void {
    const state = new StateManager(TEST_STATE);
    Assert.equal(69, state.getPath("foo/bar/baz"));
    Assert.equal(69, state.getState().foo.bar.baz);
  }

  @Fact
  public setPath(): void {
    const state = new StateManager(TEST_STATE);
    state.setPath("foo/bar/baz", 420, "test");

    Assert.equal(420, state.getPath("foo/bar/baz"));
  }

  @Fact
  public whenPathChanged(): void {
    const state = new StateManager(TEST_STATE);
    let changed = false;
    const disconnect = state.whenPathChanged("foo/bar/baz", ({ oldValue, newValue }) => {
      Assert.equal(69, oldValue);
      Assert.equal(420, newValue);
      changed = !changed;
    });

    state.setPath("foo/bar/baz", 420, "test");
    state.setPath("foo/bar", { baz: 67 }, "test");
    disconnect();
    state.setPath("foo/bar/baz", 1337, "test");
    Assert.true(changed);
  }

  @Fact
  public whenChanged(): void {
    const state = new StateManager(TEST_STATE);
    let changed = false;
    const disconnect = state.whenChanged(({ path, oldValue, newValue }) => {
      Assert.equal("foo/bar/baz", path);
      Assert.equal(69, oldValue);
      Assert.equal(420, newValue);
      changed = !changed;
    });

    state.setPath("foo/bar/baz", 420, "test");
    disconnect();
    state.setPath("foo/bar/baz", 1337, "test");
    Assert.true(changed);
  }
}

export = StateManagerTest;