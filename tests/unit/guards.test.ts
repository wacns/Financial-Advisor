import { test } from "node:test";
import assert from "node:assert/strict";
import { must } from "../../src/guards.ts";

test("must returns present values, including falsy ones", () => {
  assert.equal(must(0, "count"), 0);
  assert.equal(must("", "name"), "");
  assert.equal(must(false, "flag"), false);
});
test("must throws a clear Error for null and undefined", () => {
  assert.throws(() => must(undefined, "account"), { message: "Missing account." });
  assert.throws(() => must(null, "goal"), { message: "Missing goal." });
});
