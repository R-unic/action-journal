export type ResolvePath<T, Path extends string> =
  Path extends `${infer Key}/${infer Rest}`
  ? Key extends keyof T
  ? ResolvePath<T[Key], Rest>
  : never
  : Path extends keyof T
  ? T[Path]
  : Path extends ""
  ? T
  : never

type IsLiteralString<T extends string> = string extends T ? false : true;
export type ResolvedOrUnknown<T, Path extends string> = IsLiteralString<Path> extends true ? ResolvePath<T, Path> : unknown;

export interface Action<State extends {}, Target extends string = string> {
  readonly timestamp: number;
  readonly target: Target;
  readonly author: string;
  readonly oldValue: ResolvedOrUnknown<State, Target>;
  readonly newValue: ResolvedOrUnknown<State, Target>;
}

export interface StateChangeInfo<State extends {}, Path extends string = string> {
  readonly author: string;
  readonly path: Path;
  readonly oldValue: ResolvedOrUnknown<State, Path>;
  readonly newValue: ResolvedOrUnknown<State, Path>;
}