import { test } from "node:test";
import assert from "node:assert/strict";
import {
  authenticateWithPasskey,
  passkeyErrorMessage,
  supportsPasskeys,
} from "../lib/auth/passkeys";

test("passkeys require a secure browser and the credential API, without requiring an Apple device", () => {
  assert.equal(
    supportsPasskeys({
      secure: true,
      publicKeyCredential: true,
      credentials: true,
    }),
    true,
  );
  for (const missing of [
    "secure",
    "publicKeyCredential",
    "credentials",
  ] as const) {
    assert.equal(
      supportsPasskeys({
        secure: true,
        publicKeyCredential: true,
        credentials: true,
        [missing]: false,
      }),
      false,
    );
  }
});

test("sign-in only succeeds after Supabase returns a verified session", async () => {
  const controller = new AbortController();
  let calls = 0;
  await authenticateWithPasskey(
    {
      signInWithPasskey: async (input) => {
        calls++;
        assert.equal(input.options.signal, controller.signal);
        return {
          data: { session: { user: { id: "a" } }, user: { id: "a" } },
          error: null,
        };
      },
    },
    controller.signal,
  );
  assert.equal(calls, 1);
  for (const data of [
    null,
    { session: null, user: { id: "a" } },
    { session: { user: { id: "b" } }, user: { id: "a" } },
  ]) {
    await assert.rejects(
      authenticateWithPasskey(
        { signInWithPasskey: async () => ({ data, error: null }) },
        controller.signal,
      ),
    );
  }
});

test("cancellation and server rejection never manufacture a successful login or retry the ceremony", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    authenticateWithPasskey(
      {
        signInWithPasskey: async () => {
          calls++;
          return { data: null, error: null };
        },
      },
      controller.signal,
    ),
  );
  assert.equal(calls, 0);
  const error = { code: "passkey_disabled" };
  await assert.rejects(
    authenticateWithPasskey(
      {
        signInWithPasskey: async () => {
          calls++;
          return { data: null, error };
        },
      },
      new AbortController().signal,
    ),
    (caught) => caught === error,
  );
  assert.equal(calls, 1);
});

test("passkey errors remain actionable in French and never echo server details", () => {
  assert.match(
    passkeyErrorMessage({ code: "passkey_disabled" }),
    /pas encore activées/,
  );
  assert.match(
    passkeyErrorMessage({
      code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
      cause: { name: "NotAllowedError" },
    }),
    /annulée|interrompue/,
  );
  assert.match(
    passkeyErrorMessage({ code: "webauthn_credential_exists" }),
    /déjà/,
  );
  assert.match(passkeyErrorMessage({ code: "ERROR_INVALID_RP_ID" }), /adresse/);
  assert.doesNotMatch(
    passkeyErrorMessage({ message: "private-token-and-database-details" }),
    /private-token|database-details/,
  );
});

test("managing a key requires the authenticated owner and stops after a session change", async () => {
  const { requirePasskeyOwner } = await import("../lib/auth/passkeys");
  const controller = new AbortController();
  await requirePasskeyOwner(
    { getUser: async () => ({ data: { user: { id: "a" } }, error: null }) },
    "a",
    controller.signal,
  );
  for (const user of [null, { id: "b" }]) {
    await assert.rejects(
      requirePasskeyOwner(
        { getUser: async () => ({ data: { user }, error: null }) },
        "a",
        controller.signal,
      ),
    );
  }
  await assert.rejects(
    requirePasskeyOwner(
      {
        getUser: async () => {
          controller.abort();
          return { data: { user: { id: "a" } }, error: null };
        },
      },
      "a",
      controller.signal,
    ),
  );
});
