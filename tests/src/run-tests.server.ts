import { instrument, istanbul } from "@rbxts/coverage";
import { TestRunner } from "@rbxts/runit";

const http = game.GetService("HttpService");
const replicated = game.GetService("ReplicatedStorage");
const tests = replicated.WaitForChild("Tests");
const modules = replicated.WaitForChild("rbxts_include").WaitForChild("node_modules").WaitForChild("@rbxts");

let libName = "action-journal";
instrument([modules]);

const testRunner = new TestRunner(tests);
testRunner.run({ colors: true })
  .then(() => {
    [libName] = libName.gsub("%-", "%%-");
    const report = istanbul();
    const unmappedJSON = http.JSONEncode(report);
    let [reportJSON] = unmappedJSON.gsub('ReplicatedStorage/Library/([^"]+)', 'out/%1.luau');
    [reportJSON] = reportJSON.gsub('ReplicatedStorage/Library', 'out/init.luau');
    [reportJSON] = reportJSON.gsub(`ReplicatedStorage/rbxts_include/node_modules/@rbxts/${libName}/([^"]+)`, 'out/%1.luau');
    [reportJSON] = reportJSON.gsub(`ReplicatedStorage/rbxts_include/node_modules/@rbxts/${libName}`, 'out/init.luau');

    const coverageValue = new Instance("StringValue");
    coverageValue.Name = "coverage";
    coverageValue.Value = reportJSON;
    coverageValue.Parent = replicated;
  });