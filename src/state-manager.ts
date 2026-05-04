import Signal from "@rbxts/lemon-signal";

import type { ResolvedOrUnknown, ResolvePath } from "./structs";

const PATH_SEPARATOR = "/";

function invalidPath(path: string): never {
  return error(`Invalid path: ${path}`, 2);
}

interface StateChangeInfo<State extends {}, Path extends string = string> {
  readonly author: string;
  readonly path: Path;
  readonly oldValue: ResolvedOrUnknown<State, Path>;
  readonly newValue: ResolvedOrUnknown<State, Path>;
}

export class StateManager<State extends {}> {
  private readonly changed = new Signal<
    <Path extends string>(info: StateChangeInfo<State, Path>) => void
  >();

  public constructor(
    private state: State
  ) { }

  public whenChanged(
    callback: <Path extends string>(info: StateChangeInfo<State, Path>) => void
  ): () => void {
    const conn = this.changed.Connect(callback);
    return () => conn.Disconnect();
  }

  public whenPathChanged<Path extends string>(
    atPath: Path,
    callback: (info: Omit<StateChangeInfo<State, Path>, "path">) => void
  ): () => void {
    const conn = this.changed.Connect(info => {
      if (info.path !== atPath as string) return;
      callback(info as never);
    });

    return () => conn.Disconnect();
  }

  public setPath<Path extends string>(
    path: Path,
    value: ResolvePath<State, Path>,
    author: string,
    initialPath = path,
    history = true
  ): void {
    if (path === "") {
      this.state = value as State;
      return;
    }

    const parts = path.split(PATH_SEPARATOR);
    const field = parts.pop(); 1
    if (field === undefined)
      return invalidPath(path);

    const objectPath = parts.join(PATH_SEPARATOR);
    const object = this.getPath(objectPath);
    const oldValue = object[field as never];
    const newObject = { ...object, [field]: value };
    this.setPath(objectPath, newObject, author, initialPath);

    if (path === initialPath && history) {
      this.changed.Fire({ author, path, oldValue, newValue: value as never });
    }
  }

  public getPath<Path extends string>(path: Path): ResolvePath<State, Path> {
    if (path === "") {
      return this.state as never;
    }

    const parts = path.split(PATH_SEPARATOR);
    let current = this.state;

    for (const part of parts) {
      if (current === undefined)
        return invalidPath(path);

      current = current[part as keyof object];
    }

    return current as never;
  }

  public getState(): State {
    return this.state;
  }
}