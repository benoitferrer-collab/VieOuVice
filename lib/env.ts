export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url && !key) return null;
  if (!url || !key || url.includes("PROJECT_REF") || key.includes("REPLACE_ME"))
    throw new Error(
      "Configuration Supabase incomplète. Renseignez .env.local à partir de .env.example.",
    );
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL doit être une URL HTTPS valide.");
  }
  if (parsed.protocol !== "https:")
    throw new Error("Supabase doit utiliser HTTPS.");
  if (key.startsWith("sb_secret_"))
    throw new Error(
      "Une clé privée ne doit jamais être utilisée côté navigateur.",
    );
  if (key.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload.role !== "anon") throw new Error("Invalid public key");
    } catch {
      throw new Error("La clé legacy publique doit être une clé anon.");
    }
  }
  return { url, key };
}
