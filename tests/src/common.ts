import { Assert } from "@rbxts/runit";

export const TEST_STATE = { foo: { bar: { baz: 69 } } };
export type TestState = typeof TEST_STATE;

// silly function to have coverage for the tostring metamethod on classes
export function coverClass(object: object, name: string): void {
  Assert.equal(name, tostring(object));
}