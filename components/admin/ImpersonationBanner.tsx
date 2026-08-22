"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ImpersonationBanner({ targetName }: { targetName: string }) {
  const [exiting, setExiting] = useState(false);
  const router = useRouter();

  async function exitImpersonation() {
    setExiting(true);
    try {
      await fetch("/api/admin/impersonate/exit", { method: "POST" });
      router.push("/admin/users");
      router.refresh();
    } finally {
      setExiting(false);
    }
  }

  return (
    <div className="impersonation-banner">
      <span>Viewing as {targetName} — read-only</span>
      <button
        className="impersonation-banner__exit"
        onClick={exitImpersonation}
        disabled={exiting}
      >
        {exiting ? "Exiting..." : "Exit impersonation"}
      </button>
    </div>
  );
}
