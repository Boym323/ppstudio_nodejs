import assert from "node:assert/strict";
import test from "node:test";

import { PlannerLabSaveQueue } from "./planner-lab-save-queue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

test("rychlé změny nevytvářejí souběžné zápisy a sloučí se do posledního stavu", async () => {
  const first = deferred<{ ok: true }>();
  const calls: number[] = [];
  const saved: number[] = [];
  const queue = new PlannerLabSaveQueue<number>(
    async (value) => {
      calls.push(value);
      return calls.length === 1 ? first.promise : { ok: true };
    },
    () => {},
    (value) => saved.push(value),
    () => {},
  );

  queue.enqueue(1);
  queue.enqueue(2);
  queue.enqueue(3);
  await Promise.resolve();
  assert.deepEqual(calls, [1]);

  first.resolve({ ok: true });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, [1, 3]);
  assert.deepEqual(saved, [1, 3]);
});

test("chyba zastaví frontu a nevydá novější neověřený stav", async () => {
  const errors: string[] = [];
  const calls: number[] = [];
  const queue = new PlannerLabSaveQueue<number>(
    async (value) => {
      calls.push(value);
      return { ok: false, message: "Uložení selhalo." };
    },
    () => {},
    () => {},
    (message) => errors.push(message),
  );

  queue.enqueue(1);
  queue.enqueue(2);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, [1]);
  assert.deepEqual(errors, ["Uložení selhalo."]);
});
