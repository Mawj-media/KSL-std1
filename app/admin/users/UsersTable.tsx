"use client";

import { useState } from "react";

type UserRow = { id: string; email: string | null; name: string | null; role: string };

export function UsersTable({
  users,
  grants,
  standards,
}: {
  users: UserRow[];
  grants: Map<string, boolean>;
  standards: string[];
}) {
  const [grantMap, setGrantMap] = useState(grants);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggle(userId: string, code: string, grant: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, standardCode: code, action: grant ? "grant" : "revoke" }),
      });
      if (res.ok) {
        setGrantMap((prev) => {
          const next = new Map(prev);
          if (grant) next.set(`${userId}:${code}`, true);
          else next.delete(`${userId}:${code}`);
          return next;
        });
      }
    } finally {
      setBusy(false);
    }
  }

  if (users.length === 0) {
    return <p style={{ marginTop: 20 }}>No users synced yet. Configure the Clerk webhook to populate this list.</p>;
  }

  return (
    <div className="admin-users">
      {users.map((u) => {
        const granted = standards.filter((c) => grantMap.has(`${u.id}:${c}`)).length;
        const open = expanded === u.id;
        return (
          <div className="admin-user" key={u.id}>
            <div className="admin-user-head" onClick={() => setExpanded(open ? null : u.id)}>
              <div>
                <div className="admin-user-name">{u.name || "Unnamed user"}</div>
                <div className="admin-user-email">{u.email || "no email"}</div>
              </div>
              <span className={`admin-pill ${u.role === "admin" ? "admin-pill-available" : "admin-pill-none"}`}>
                {u.role}
              </span>
              <span className="admin-pill admin-pill-draft">
                {granted}/{standards.length} standards
              </span>
              <span className="admin-chevron">{open ? "▾" : "▸"}</span>
            </div>
            {open && (
              <div className="admin-grant-grid">
                {standards.map((code) => {
                  const has = grantMap.has(`${u.id}:${code}`);
                  return (
                    <label className="admin-check" key={code}>
                      <input
                        type="checkbox"
                        checked={has}
                        disabled={busy || u.role === "admin"}
                        onChange={(e) => toggle(u.id, code, e.target.checked)}
                      />
                      {code}
                    </label>
                  );
                })}
                {standards.length === 0 && <p>No published standards yet.</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}