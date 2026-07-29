import assert from "node:assert/strict";
import test from "node:test";

import { PlannerLabSaveQueue } from "./planner-lab-save-queue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

async function nextTurn() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("jedna změna se uloží a stav Uloženo nastane až po vyprázdnění fronty", async () => {
  const calls: number[] = [];
  const saved: number[] = [];
  let drained = 0;
  const queue = new PlannerLabSaveQueue<number>(
    async (value) => { calls.push(value); return { ok: true }; },
    () => {},
    (value) => saved.push(value),
    () => { drained += 1; },
    () => {},
  );

  queue.enqueue(1);
  await nextTurn();
  assert.deepEqual(calls, [1]);
  assert.deepEqual(saved, [1]);
  assert.equal(drained, 1);
});

test("rychlé změny se ukládají FIFO bez souběžných zápisů", async () => {
  const first = deferred<{ ok: true }>();
  const calls: number[] = [];
  const saved: number[] = [];
  let drained = 0;
  const queue = new PlannerLabSaveQueue<number>(
    async (value) => {
      calls.push(value);
      return calls.length === 1 ? first.promise : { ok: true };
    },
    () => {},
    (value) => saved.push(value),
    () => { drained += 1; },
    () => {},
  );

  queue.enqueue(1);
  queue.enqueue(2);
  queue.enqueue(3);
  await Promise.resolve();
  assert.deepEqual(calls, [1]);
  assert.equal(drained, 0);

  first.resolve({ ok: true });
  await nextTurn();
  assert.deepEqual(calls, [1, 2, 3]);
  assert.deepEqual(saved, [1, 2, 3]);
  assert.equal(drained, 1);
});

test("přidání a následné odebrání stejného intervalu zachová pořadí obou změn", async () => {
  const calls: Array<"add" | "remove"> = [];
  const queue = new PlannerLabSaveQueue<"add" | "remove">(
    async (value) => { calls.push(value); return { ok: true }; },
    () => {},
    () => {},
    () => {},
    () => {},
  );

  queue.enqueue("add");
  queue.enqueue("remove");
  await nextTurn();
  assert.deepEqual(calls, ["add", "remove"]);
});

test("selhání prostřední změny ji ponechá ve frontě a retry pokračuje stejným pořadím", async () => {
  const calls: number[] = [];
  const saved: number[] = [];
  const errors: string[] = [];
  let attemptTwo = 0;
  const queue = new PlannerLabSaveQueue<number>(
    async (value) => {
      calls.push(value);
      if (value === 2 && attemptTwo++ === 0) return { ok: false, message: "Uložení selhalo." };
      return { ok: true };
    },
    () => {},
    (value) => saved.push(value),
    () => {},
    (message) => errors.push(message),
  );

  queue.enqueue(1);
  queue.enqueue(2);
  queue.enqueue(3);
  await nextTurn();
  assert.deepEqual(calls, [1, 2]);
  assert.deepEqual(saved, [1]);
  assert.deepEqual(errors, ["Uložení selhalo."]);

  queue.retry();
  await nextTurn();
  assert.deepEqual(calls, [1, 2, 2, 3]);
  assert.deepEqual(saved, [1, 2, 3]);
});

test("opakované selhání zůstává viditelné a retry nezdvojí úspěšnou změnu", async () => {
  const calls: number[] = [];
  const errors: string[] = [];
  const queue = new PlannerLabSaveQueue<number>(
    async (value) => {
      calls.push(value);
      return value === 1 ? { ok: true } : { ok: false, message: "Stále se nepodařilo uložit." };
    },
    () => {},
    () => {},
    () => {},
    (message) => errors.push(message),
  );

  queue.enqueue(1);
  queue.enqueue(2);
  await nextTurn();
  queue.retry();
  await nextTurn();
  assert.deepEqual(calls, [1, 2, 2]);
  assert.deepEqual(errors, ["Stále se nepodařilo uložit.", "Stále se nepodařilo uložit."]);
});

test("změny vytvořené během retry zůstanou za neúspěšnou položkou", async () => {
  const retry = deferred<{ ok: true }>();
  const calls: number[] = [];
  let secondAttempt = false;
  const queue = new PlannerLabSaveQueue<number>(
    async (value) => {
      calls.push(value);
      if (value === 1 && !secondAttempt) return { ok: false, message: "Uložení selhalo." };
      return value === 1 ? retry.promise : { ok: true };
    },
    () => {},
    () => {},
    () => {},
    () => {},
  );

  queue.enqueue(1);
  await nextTurn();
  secondAttempt = true;
  queue.retry();
  queue.enqueue(2);
  await Promise.resolve();
  assert.deepEqual(calls, [1, 1]);

  retry.resolve({ ok: true });
  await nextTurn();
  assert.deepEqual(calls, [1, 1, 2]);
});
