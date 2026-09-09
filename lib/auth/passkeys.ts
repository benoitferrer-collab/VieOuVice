export function supportsPasskeys(capabilities: {
  secure: boolean;
  publicKeyCredential: boolean;
  credentials: boolean;
}) {
  return (
    capabilities.secure &&
    capabilities.publicKeyCredential &&
    capabilities.credentials
  );
}

export async function requirePasskeyOwner(
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  },
  userId: string,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const {
    data: { user },
    error,
  } = await auth.getUser();
  if (error) throw error;
  signal?.throwIfAborted();
  if (!user || user.id !== userId) throw { code: "session_changed" };
}

type SignInPort = {
  signInWithPasskey(input: { options: { signal: AbortSignal } }): Promise<{
    data: {
      session: { user: { id: string } } | null;
      user: { id: string } | null;
    } | null;
    error: unknown;
  }>;
};

// Supabase performs WebAuthn verification and persists its normal SSR session.
// A browser credential alone never counts as an authenticated game session.
export async function authenticateWithPasskey(
  auth: SignInPort,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const { data, error } = await auth.signInWithPasskey({ options: { signal } });
  if (error) throw error;
  signal.throwIfAborted();
  if (!data?.session || !data.user || data.session.user.id !== data.user.id)
    throw new Error("Passkey session was not confirmed");
}

export function passkeyErrorMessage(error: unknown): string {
  const details = error as {
    code?: string;
    name?: string;
    cause?: { name?: string };
  } | null;
  const code = details?.code;
  if (code === "passkey_disabled")
    return "Les clés d’accès ne sont pas encore activées pour ce jeu. Tu peux utiliser ton mot de passe.";
  if (
    code === "ERROR_CEREMONY_ABORTED" ||
    details?.name === "AbortError" ||
    details?.name === "NotAllowedError" ||
    details?.cause?.name === "NotAllowedError"
  )
    return "Demande annulée ou interrompue. Tu peux réessayer ou utiliser ton mot de passe.";
  if (
    code === "webauthn_credential_exists" ||
    code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED"
  )
    return "Cette clé est déjà enregistrée pour ton compte.";
  if (code === "webauthn_credential_not_found")
    return "Cette clé n’est plus reconnue. Connecte-toi avec ton mot de passe pour en ajouter une.";
  if (
    code === "ERROR_INVALID_RP_ID" ||
    code === "ERROR_INVALID_DOMAIN" ||
    details?.name === "SecurityError"
  )
    return "Cette adresse ne permet pas d’utiliser la clé. Ouvre le jeu à son adresse habituelle.";
  if (code === "email_not_confirmed" || code === "phone_not_confirmed")
    return "Confirme d’abord ton compte avec le lien reçu par email.";
  if (
    code === "session_not_found" ||
    code === "user_banned" ||
    code === "session_changed"
  )
    return "Reconnecte-toi à ton compte avant de gérer ses clés d’accès.";
  if (code === "too_many_passkeys")
    return "La limite de clés est atteinte. Retire une ancienne clé avant d’en ajouter une autre.";
  if (
    code === "webauthn_challenge_expired" ||
    code === "webauthn_challenge_not_found"
  )
    return "La demande a expiré. Lance une nouvelle tentative.";
  return "La demande n’a pas abouti. Réessaie ou utilise ton mot de passe.";
}
