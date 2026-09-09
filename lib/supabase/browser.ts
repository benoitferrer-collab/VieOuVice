import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "../env";
export function browserClient() {
  const config = supabaseConfig();
  if (!config)
    throw new Error(
      "Supabase non configuré. Utilisez la démo ou configurez .env.local.",
    );
  return createBrowserClient(config.url, config.key, {
    auth: { experimental: { passkey: true } },
  });
}
