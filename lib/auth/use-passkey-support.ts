"use client";
import { useSyncExternalStore } from "react";
import { supportsPasskeys } from "./passkeys";
const subscribe = () => () => {};
const serverSnapshot = () => false;
function browserSnapshot() {
  return supportsPasskeys({
    secure: window.isSecureContext,
    publicKeyCredential: typeof window.PublicKeyCredential !== "undefined",
    credentials:
      !!navigator.credentials?.create && !!navigator.credentials?.get,
  });
}
export function usePasskeySupport() {
  return useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
}
