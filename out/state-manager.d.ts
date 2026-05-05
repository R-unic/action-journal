import type { ResolvePath, StateChangeInfo } from "./structs";
export declare class StateManager<State extends {}> {
    private state;
    readonly initial: State;
    private readonly changed;
    constructor(state: State);
    whenChanged(callback: <Path extends string>(info: StateChangeInfo<State, Path>) => void): () => void;
    whenPathChanged<Path extends string>(atPath: Path, callback: (info: Omit<StateChangeInfo<State, Path>, "path">) => void): () => void;
    setPath<Path extends string>(path: Path, value: ResolvePath<State, Path>, author: string, initialPath?: Path, history?: boolean): void;
    getPath<Path extends string>(path: Path): ResolvePath<State, Path>;
    getState(): State;
}
