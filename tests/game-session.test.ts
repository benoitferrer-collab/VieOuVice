import { test } from "node:test";
import assert from "node:assert/strict";
import { GameSessionGate } from "../lib/game-session";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("a delayed account A load is stale after logout and login as B", async () => {
  const gate = new GameSessionGate();
  const accountA = gate.enterAccount("account-a");
  const response = deferred<{
    data: { id: string; nickname: string };
    error: null;
  }>();
  const pending = gate.load(accountA, "account-a", () => response.promise);

  gate.enterSignedOut();
  gate.enterAccount("account-b");
  response.resolve({
    data: { id: "account-a", nickname: "Alice" },
    error: null,
  });

  assert.deepEqual(await pending, { status: "stale" });
});

test("a delayed account load is stale after entering demo", async () => {
  const gate = new GameSessionGate();
  const account = gate.enterAccount("account-a");
  const response = deferred<{ data: { id: string }; error: null }>();
  const pending = gate.load(account, "account-a", () => response.promise);

  gate.enterDemo();
  response.resolve({ data: { id: "account-a" }, error: null });

  assert.deepEqual(await pending, { status: "stale" });
});

test("a current load with another account identity is refused", async () => {
  const gate = new GameSessionGate();
  const account = gate.enterAccount("account-a");

  assert.deepEqual(
    await gate.load(account, "account-a", async () => ({
      data: { id: "account-b" },
      error: null,
    })),
    { status: "identity-mismatch" },
  );
});

test("the new account can load while the old response remains pending", async () => {
  const gate = new GameSessionGate();
  const old = gate.enterAccount("a");
  const response = deferred<{ data: { id: string }; error: null }>();
  const pending = gate.load(old, "a", () => response.promise);
  const fresh = gate.enterAccount("b");
  assert.deepEqual(
    await gate.load(fresh, "b", async () => ({
      data: { id: "b" },
      error: null,
    })),
    { status: "loaded", data: { id: "b" } },
  );
  response.resolve({ data: { id: "a" }, error: null });
  assert.deepEqual(await pending, { status: "stale" });
});

test("a new account without a game profile still reaches onboarding", async () => {
  const gate = new GameSessionGate();
  const ticket = gate.enterAccount("new");
  assert.deepEqual(
    await gate.load(ticket, "new", async () => ({ data: null, error: null })),
    { status: "loaded", data: null },
  );
});

test("a late network error does not contaminate the next session", async () => {
  const gate = new GameSessionGate();
  const ticket = gate.enterAccount("a");
  const response = deferred<void>();
  const pending = gate.load(ticket, "a", async () => {
    await response.promise;
    throw Error("old network failure");
  });
  gate.enterSignedOut();
  response.resolve();
  assert.deepEqual(await pending, { status: "stale" });
});
