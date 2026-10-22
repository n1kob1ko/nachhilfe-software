import assert from "node:assert/strict";
import test from "node:test";
import { DRAFT_PREFIX } from "../components/laptop/drafts";
import { beilageKey } from "./text-ansicht";

test("the hidden Textbeilage is remembered per text, beside the copy of the text but not under its prefix", () => {
  assert.equal(beilageKey("lernheft-text-", 12), "lernheft-beilage-12");
  assert.equal(beilageKey(DRAFT_PREFIX, 12), "lernheft-laptop-beilage-12");
  assert.notEqual(beilageKey("lernheft-text-", 12), beilageKey("lernheft-text-", 13));
  for (const prefix of ["lernheft-text-", DRAFT_PREFIX, "eigen"]) {
    assert.ok(!beilageKey(prefix, 12).startsWith(prefix), `${prefix}: not read as a copy of a text`);
  }
  assert.equal(beilageKey("eigen", 12), "lernheft-beilage-12");
  assert.ok(beilageKey(DRAFT_PREFIX, 12).startsWith("lernheft-laptop-"), "removed with the laptop's data");
});
