import test from "node:test";
import assert from "node:assert/strict";
import { sourceInputs } from "../../scripts/verify-ios-inputs.ts";
test("Xcode source paths use group paths rather than their display names", () => {
  const objects = {
    PBXGroup: {
      root: {
        sourceTree: '"<group>"',
        children: [{ value: "displayOnly" }, { value: "nested" }],
      },
      displayOnly: {
        name: "MyApp",
        sourceTree: '"<group>"',
        children: [{ value: "intent" }],
      },
      nested: {
        path: "Native",
        sourceTree: '"<group>"',
        children: [{ value: "speech" }],
      },
    },
    PBXFileReference: {
      intent: {
        path: '"MyApp/FinancialAdvisorIntents.swift"',
        sourceTree: '"<group>"',
      },
      speech: { path: "Speech.swift", sourceTree: '"<group>"' },
    },
    PBXBuildFile: { a: { fileRef: "intent" }, b: { fileRef: "speech" } },
    PBXSourcesBuildPhase: {
      sources: { files: [{ value: "a" }, { value: "b" }] },
    },
  };
  assert.deepEqual(sourceInputs(objects, "root", "/project/ios"), [
    "/project/ios/MyApp/FinancialAdvisorIntents.swift",
    "/project/ios/Native/Speech.swift",
  ]);
  objects.PBXFileReference.intent.path = "FinancialAdvisorIntents.swift";
  assert.equal(
    sourceInputs(objects, "root", "/project/ios")[0],
    "/project/ios/FinancialAdvisorIntents.swift",
  );
});
