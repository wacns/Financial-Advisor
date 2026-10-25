import { test } from "node:test";
import assert from "node:assert/strict";
import { toFils } from "../../src/locale.ts";
import { amount, convert, normalizeWorkspace } from "../../src/domain/model.ts";

const precision = { message: "Enter an amount with no more than three decimal places." };
const missing = { message: "Enter an amount." };

test("toFils keeps today's results for awkward inputs", () => {
  assert.throws(() => toFils("0.0005"), precision);
  assert.equal(toFils("1e3"), 1000000);
  assert.equal(toFils(" 2.5 "), 2500);
  assert.equal(toFils(""), 0);
  assert.equal(toFils(null), 0);
  assert.equal(toFils(true), 1000);
  assert.equal(toFils(-4.25), -4250);
  assert.equal(toFils(1e12), 1e15);
  assert.throws(() => toFils(1e12 + 1), precision);
  assert.equal(toFils("١٢٫٥"), 12500);
  assert.throws(() => toFils("abc"), precision);
  assert.equal(toFils(0.1 + 0.2), 300);
});

test("amount keeps today's results for awkward inputs", () => {
  assert.throws(() => amount("0.0005"), precision);
  assert.equal(amount("1e3"), 1000);
  assert.equal(amount(" 2.5 "), 2.5);
  assert.throws(() => amount(""), missing);
  assert.throws(() => amount(null), missing);
  assert.throws(() => amount(true), missing);
  assert.equal(amount(-4.25), -4.25);
  assert.throws(() => amount(-4.25, true), { message: "Amount must be greater than zero." });
  assert.equal(amount(1e12), 1e12);
  assert.equal(amount("١٢٫٥", true), 12.5);
  assert.equal(amount(0.1 + 0.2), 0.3);
});

test("convert keeps today's rounding and rate checks", () => {
  const s = normalizeWorkspace({ currency: "BHD" });
  assert.equal(convert(s, 10, "USD", "BHD"), 3.76);
  assert.equal(convert(s, "3.333", "BHD", "USD"), 8.864);
  assert.throws(() => convert(s, 1, "XYZ", "BHD"), {
    message: "Set a positive exchange rate for both currencies.",
  });
});
