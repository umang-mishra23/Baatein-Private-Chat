import test from "node:test";
import assert from "node:assert/strict";
import { reportSchema } from "@/lib/validation";

test("Phase 5 report schema accepts supported reasons", () => {
  for (const reason of ["SPAM", "HARASSMENT", "THREATS", "IMPERSONATION", "OTHER"] as const) {
    assert.equal(reportSchema.safeParse({ reason }).success, true);
  }
});

test("Phase 5 report schema rejects arbitrary reason values", () => {
  assert.equal(reportSchema.safeParse({ reason: "MAKE_ME_ADMIN" }).success, false);
});

test("Phase 5 report details are bounded", () => {
  assert.equal(reportSchema.safeParse({ reason: "OTHER", details: "x".repeat(2000) }).success, true);
  assert.equal(reportSchema.safeParse({ reason: "OTHER", details: "x".repeat(2001) }).success, false);
});
