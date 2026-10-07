import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-slate-900">
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="mt-2">This record does not exist or is not visible to your role.</p>
      <Link href="/" className="mt-4 inline-block font-semibold text-blue-800 underline">Go to your dashboard</Link>
    </main>
  );
}
