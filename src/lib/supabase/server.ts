import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "./env";

/** Session-aware client (anon key + user's auth cookie). Used only to identify the user. */
export async function createSessionClient() {
  const { url, anonKey } = publicEnv();
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // called from a Server Component — the proxy refreshes cookies instead
        }
      },
    },
  });
}
