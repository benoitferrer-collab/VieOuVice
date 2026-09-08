import { Game } from "@/components/game";
import { supabaseConfig } from "@/lib/env";
export default function Page() {
  let configured = false;
  let error = "";
  try {
    configured = !!supabaseConfig();
  } catch (e) {
    error = e instanceof Error ? e.message : "Configuration invalide.";
  }
  return <Game configured={configured} configError={error} />;
}
