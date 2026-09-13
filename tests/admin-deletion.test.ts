import { test } from "node:test";
import assert from "node:assert/strict";
import {
  handleAccountDeletion,
  type AccountDeletionServices,
} from "../lib/admin/account-deletion";
const actor = "11111111-1111-4111-8111-111111111111";
const target = "22222222-2222-4222-8222-222222222222";
function request(
  body: unknown = { user_id: target, confirmation: "Joueur" },
  token = "verified-token",
) {
  return new Request("https://example.test/api/admin/accounts", {
    method: "DELETE",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  });
}
function fixture() {
  const calls: unknown[] = [];
  const services: AccountDeletionServices = {
    verify: async (token) => {
      calls.push(["verify", token]);
      return { id: actor };
    },
    prepare: async (...args) => {
      calls.push(["prepare", ...args]);
      return null;
    },
    remove: async (id) => {
      calls.push(["remove", id]);
      return true;
    },
  };
  return { services, calls };
}
test("account deletion authenticates, reserves an exact confirmation, then calls Auth", async () => {
  const { services, calls } = fixture();
  assert.equal((await handleAccountDeletion(request(), services)).status, 200);
  assert.deepEqual(calls, [
    ["verify", "verified-token"],
    ["prepare", actor, target, "Joueur"],
    ["remove", target],
  ]);
});
test("missing auth, malformed requests and self deletion never call Auth removal", async () => {
  for (const input of [
    request(undefined, ""),
    request({ user_id: target, confirmation: "Joueur", is_admin: true }),
    request({ user_id: actor, confirmation: "Joueur" }),
    request({ user_id: "bad", confirmation: "Joueur" }),
  ]) {
    const { services, calls } = fixture();
    assert.ok((await handleAccountDeletion(input, services)).status >= 400);
    assert.ok(!calls.some((c) => (c as string[])[0] === "remove"));
  }
});
test("server permission rejection prevents deletion and does not leak DB details", async () => {
  const { services, calls } = fixture();
  services.prepare = async () => ({
    code: "42501",
    message: "secret database internals",
  });
  const result = await handleAccountDeletion(request(), services);
  assert.equal(result.status, 403);
  assert.ok(!(await result.text()).includes("secret"));
  assert.ok(!calls.some((c) => (c as string[])[0] === "remove"));
});
test("unverified identity and failed Auth deletion cannot return success", async () => {
  const { services } = fixture();
  services.verify = async () => null;
  assert.equal((await handleAccountDeletion(request(), services)).status, 401);
  services.verify = async () => ({ id: actor });
  services.remove = async () => false;
  assert.equal((await handleAccountDeletion(request(), services)).status, 503);
  services.remove = async () => {
    throw Error("secret");
  };
  const result = await handleAccountDeletion(request(), services);
  assert.equal(result.status, 503);
  assert.ok(!(await result.text()).includes("secret"));
});
