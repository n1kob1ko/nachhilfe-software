import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { jsonIn, withSchemaInstruction } from "./schema";

test("jsonIn: ein Objekt, auch in einem Code-Block oder mit Satz davor", () => {
  assert.deepEqual(jsonIn('{"a":1}'), { a: 1 });
  assert.deepEqual(jsonIn('Hier:\n```json\n{"a":[1,2]}\n```'), { a: [1, 2] });
});

test("jsonIn: eine Liste bleibt eine Liste (Bankeinträge, Simulation 27.11.2026)", () => {
  assert.deepEqual(jsonIn('[{"x":1}]'), [{ x: 1 }]);
  assert.deepEqual(jsonIn('```json\n[{"x":1},{"x":2}]\n```'), [{ x: 1 }, { x: 2 }]);
});

test("jsonIn: eine eckige Klammer im Satz davor stört ein Objekt nicht", () => {
  assert.deepEqual(jsonIn('Siehe [1]: {"a":true}'), { a: true });
  assert.equal(jsonIn("kein JSON"), null);
});

test("withSchemaInstruction nennt Array oder Objekt wie das Schema", () => {
  assert.match(withSchemaInstruction("S", z.array(z.object({ x: z.number() }))), /einem JSON-Array/);
  assert.match(withSchemaInstruction("S", z.object({ x: z.number() })), /einem JSON-Objekt/);
});
