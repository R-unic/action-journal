import { Assert } from "@rbxts/runit";

// silly function to have coverage for the tostring metamethod on classes
export function coverClass(object: object, name: string): void {
  Assert.equal(name, tostring(object));
}