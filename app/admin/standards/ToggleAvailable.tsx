"use client";

import { useState } from "react";

export function ToggleAvailable({ code, available }: { code: string; available: boolean }) {
  const [value, setValue] = useState(available);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/standards/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !value }),
      });
      if (res.ok) setValue((v) => !v);
    } finally {
      setSaving(false);
    }
  }

  return (
    <button className="admin-btn" onClick={toggle} disabled={saving}>
      {value ? "Hide" : "Show"}
    </button>
  );
}