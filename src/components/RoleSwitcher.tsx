"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLE_HOME, ROLE_LABELS, type Role } from "@/lib/domain";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Demo persona switcher. It performs a REAL sign-out + sign-in as the chosen
 * demo account — it does not just flip a client-side flag — so every request
 * afterwards carries that user's JWT and is authorised on the server.
 */
export function RoleSwitcher({ current }: { current?: Role }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function switchTo(role: Role) {
    if (role === current) return;
    const acct = DEMO_ACCOUNTS.find((a) => a.role === role)!;
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithPassword({ email: acct.email, password: DEMO_PASSWORD });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(ROLE_HOME[role]);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="role-switcher" className="text-xs font-semibold text-slate-200">
        Switch demo role
      </label>
      <select
        id="role-switcher"
        value={current ?? ""}
        disabled={busy}
        onChange={(e) => switchTo(e.target.value as Role)}
        className="min-w-52"
        style={{ padding: "0.35rem 0.6rem", fontSize: "0.9rem" }}
      >
        {!current && <option value="">Choose a role…</option>}
        {DEMO_ACCOUNTS.map((a) => (
          <option key={a.role} value={a.role}>
            {ROLE_LABELS[a.role]} ({a.name})
          </option>
        ))}
      </select>
      {busy && <span className="text-xs text-white">Switching…</span>}
      {error && <span className="text-xs font-semibold text-red-200">{error}</span>}
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded-lg border border-white px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700"
      onClick={async () => {
        await createBrowserSupabase().auth.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
