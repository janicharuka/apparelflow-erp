"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn } from "@/components/ui";
import { api } from "@/lib/api-client";

export function StartSewingButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="text-right">
      <button
        className={btn.primary}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await api(`/api/sewing/${orderId}/start`, "POST");
          setBusy(false);
          if (!res.ok) setError(res.error ?? "Failed");
          else router.refresh();
        }}
      >
        {busy ? "Starting…" : "Start Sewing Assembly"}
      </button>
      {error && <p role="alert" className="mt-1 text-xs font-semibold text-red-800">{error}</p>}
    </div>
  );
}
