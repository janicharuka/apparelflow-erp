import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in — ApparelFlow ERP" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">ApparelFlow ERP</h1>
        <p className="text-slate-700">Cutting Operations &amp; Gatekeeper Verification Terminal</p>
      </div>
      <LoginForm />
    </main>
  );
}
