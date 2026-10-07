"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn, Alert } from "@/components/ui";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo";
import { ROLE_HOME, ROLE_LABELS, type Role } from "@/lib/domain";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const ROLE_BLURB: Record<Role, string> = {
  cutting_supervisor: "Creates cutting orders from recipes and submits batches to QC.",
  cutting_verifier: "Counts components, triggers traffic lights, approves or rejects.",
  sewing_supervisor: "Sees ONLY verified batches and starts sewing assembly.",
};

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: string, p: string) {
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithPassword({ email: e, password: p });
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const res = await fetch("/api/me", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok || !json?.data?.role) {
      setError("Signed in, but this account has no ERP role assigned. Run `npm run seed:users`.");
      return;
    }
    router.push(ROLE_HOME[json.data.role as Role]);
    router.refresh();
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Sign in</h2>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!email.trim() || !password) {
              setError("Email and password are required");
              return;
            }
            signIn(email.trim(), password);
          }}
        >
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-semibold text-slate-900">Email</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@factory.com" />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-semibold text-slate-900">Password</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <Alert kind="error">{error}</Alert>}
          <button type="submit" disabled={busy} className={btn.primary + " w-full"}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border-2 border-blue-700 bg-blue-50 p-6">
        <h2 className="text-lg font-bold text-slate-900">Demo Credential Panel</h2>
        <p className="mb-4 text-sm text-slate-800">
          Password for all accounts: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-900">{DEMO_PASSWORD}</code>
        </p>
        <ul className="space-y-3">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.role} className="rounded-lg border border-slate-300 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-900">{ROLE_LABELS[a.role]}</div>
                  <div className="font-mono text-sm text-slate-800">{a.email}</div>
                </div>
                <button type="button" disabled={busy} className={btn.secondary} onClick={() => signIn(a.email, DEMO_PASSWORD)}>
                  Sign in as {a.name.split(" ")[0]}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-700">{ROLE_BLURB[a.role]}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
