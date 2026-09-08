"use client";
import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";

const OWNER_KEY = "viegame.push.owner";
const PENDING_KEY = "viegame.push.pending-unregister";
function supported() {
  return window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
function applicationKey(value: string) {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}
async function existingSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return await registration?.pushManager.getSubscription() ?? null;
}
async function removeSubscription(subscription: PushSubscription) {
  // Unregister first so a failed browser operation cannot continue future jobs.
  // Always try the browser too: logout can work while the server is unreachable.
  let serverRemoved = false;
  let browserRemoved = false;
  try {
    const { data: own, error: statusError } = await browserClient().rpc("get_push_subscription_status", { p_endpoint: subscription.endpoint });
    if (!statusError && own) {
      const { error } = await browserClient().rpc("unregister_push_subscription", { p_endpoint: subscription.endpoint });
      serverRemoved = !error;
    }
  } catch { /* Attempt local removal independently. */ }
  try { browserRemoved = await subscription.unsubscribe(); } catch { /* Retry can remove either side. */ }
  if (!serverRemoved && !browserRemoved) throw new Error("Impossible de couper les notifications de ce navigateur. Réessaie avant de te déconnecter.");
  if (!serverRemoved && browserRemoved) {
    // No deliveries can reach this expired endpoint. Retry own DB cleanup later.
    localStorage.setItem(PENDING_KEY, subscription.endpoint);
  }
  localStorage.removeItem(OWNER_KEY);
  return browserRemoved;
}
/** Call and await before auth.signOut; either server or browser removal suffices. */
export async function cleanupWebPushBeforeSignOut() {
  if (!supported()) return;
  const subscription = await existingSubscription();
  if (subscription) await removeSubscription(subscription);
}

export function WebPushSettings({ demo, userId }: { demo: boolean; userId?: string }) {
  const [config, setConfig] = useState<{ configured: boolean; publicKey: string | null } | null>(null);
  const [status, setStatus] = useState("Vérification du navigateur…");
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function inspect() {
      if (demo) { setStatus("En démo, aucune notification n’est envoyée.");return; }
      if (!supported()) { setStatus("Notifications indisponibles ici. Sur iPhone, ajoute le jeu à l’écran d’accueil puis ouvre-le depuis son icône.");return; }
      setAvailable(true);
      setDenied(Notification.permission === "denied");
      try {
        const response = await fetch("/api/push/config", { cache: "no-store" });
        if (!response.ok) throw new Error("Configuration indisponible.");
        const settings = await response.json();
        const db = browserClient();
        const { data: { user }, error: authError } = await db.auth.getUser();
        if (authError || !user) throw new Error("Connecte-toi pour gérer les notifications.");
        const pending = localStorage.getItem(PENDING_KEY);
        if (pending) {
          const { error } = await db.rpc("unregister_push_subscription", { p_endpoint: pending });
          if (!error) localStorage.removeItem(PENDING_KEY);
        }
        const subscription = await existingSubscription();
        let owned = false;
        if (subscription) {
          const { data, error } = await db.rpc("get_push_subscription_status", { p_endpoint: subscription.endpoint });
          if (error) throw new Error("La mise à jour Web Push de la base est requise.");
          owned = data === true;
          if (!owned) {
            // Shared browser/account switch: invalidate the previous endpoint;
            // never silently attach it to the current account.
            if (!await subscription.unsubscribe()) throw new Error("Réinitialise les notifications dans les réglages du navigateur.");
            localStorage.removeItem(OWNER_KEY);
          } else localStorage.setItem(OWNER_KEY, user.id);
        }
        if (cancelled) return;
        setConfig(settings);
        setEnabled(owned);
        setStatus(owned ? "Activées pour ce compte sur ce navigateur." : !settings.configured ? "Activation disponible après le déploiement du service Web Push." : Notification.permission === "denied" ? "Permission refusée. Tu peux la modifier dans les réglages du navigateur." : "Désactivées sur ce navigateur.");
      } catch (error) { if (!cancelled) setStatus(error instanceof Error ? error.message : "Vérification impossible. Recharge la page pour réessayer."); }
    }
    void inspect();
    return () => { cancelled = true; };
  }, [demo, userId]);

  async function enable() {
    if (!config?.configured || !config.publicKey || busy) return;
    setBusy(true);
    let created: PushSubscription | null = null;
    try {
      // Request only from this explicit click, before any network await.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDenied(permission === "denied");
        setStatus(permission === "denied" ? "Permission refusée. Modifie-la dans les réglages du navigateur." : "Aucune permission accordée. Tu peux réessayer quand tu veux.");
        return;
      }
      const db = browserClient();
      const { data: { user }, error: authError } = await db.auth.getUser();
      if (authError || !user || (userId && user.id !== userId)) throw new Error("Reconnecte-toi avant d’activer les notifications.");
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      await navigator.serviceWorker.ready;
      const previous = await registration.pushManager.getSubscription();
      if (previous) {
        const { data: own, error } = await db.rpc("get_push_subscription_status", { p_endpoint: previous.endpoint });
        if (error) throw new Error("La mise à jour Web Push de la base est requise.");
        if (own) { setEnabled(true);setStatus("Déjà activées sur ce navigateur.");return; }
        if (!await previous.unsubscribe()) throw new Error("Réinitialise les notifications du navigateur avant de réessayer.");
      }
      created = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(config.publicKey) });
      const serialized = created.toJSON();
      const { error } = await db.rpc("register_push_subscription", { p_endpoint: created.endpoint, p_p256dh: serialized.keys?.p256dh, p_auth: serialized.keys?.auth });
      if (error) throw new Error("Abonnement non enregistré. Vérifie le déploiement Web Push puis réessaie.");
      localStorage.setItem(OWNER_KEY, user.id);
      setEnabled(true);
      setStatus("Activées pour ce compte sur ce navigateur. Les détails restent dans le jeu.");
    } catch (error) {
      if (created) {
        try { await removeSubscription(created); } catch { setStatus("Enregistrement incomplet. Coupe les notifications dans les réglages du navigateur, puis réessaie.");return; }
      }
      setStatus(error instanceof Error ? error.message : "Activation impossible. Réessaie.");
    } finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true);
    try {
      const subscription = await existingSubscription();
      const removed = subscription ? await removeSubscription(subscription) : true;
      setEnabled(false);
      setStatus(removed ? "Désactivées sur ce navigateur." : "Envoi désactivé. Réessaie pour retirer aussi l’abonnement du navigateur.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Désactivation impossible. Réessaie."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4" aria-label="Notifications du navigateur">
    <h3 className="font-semibold">Notifications du navigateur</h3>
    <p className="text-sm text-white/60">Avec ton accord, le jeu peut te prévenir même fermé. Seul « Du nouveau dans ta partie » apparaît, sans nom, action ni score.</p>
    <p role="status" className="text-sm text-white/70">{status}</p>
    {!demo && available && <button type="button" disabled={busy || (!enabled && (!config?.configured || denied))} onClick={() => void (enabled ? disable() : enable())} className="rounded-xl border border-white/20 px-4 py-2 text-sm disabled:opacity-40">{busy ? "En cours…" : enabled ? "Désactiver sur ce navigateur" : "Activer volontairement"}</button>}
  </section>;
}
export default WebPushSettings;
