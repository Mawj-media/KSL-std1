"use client";

import { useState } from "react";

type Member = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  orgRole: string;
  progress: Map<string, string>;
};

type Org = {
  id: string;
  name: string;
  clerkOrgId: string | null;
  memberCount: number;
  members: Member[];
};

type Status = "Completed" | "In Progress" | "Not Started" | "N/A";

function statusFor(row: string | undefined): Status {
  if (!row) return "Not Started";
  if (row === "completed") return "Completed";
  if (row === "na") return "N/A";
  return "In Progress";
}

function initials(name: string | null, email: string | null) {
  if (name) {
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

const STAT_COLORS: Record<Status, string> = {
  Completed: "#16A34A",
  "In Progress": "#F59E0B",
  "Not Started": "#9CA3AF",
  "N/A": "#D1D5DB",
};

export function OrgUsersConsole({
  orgs,
  grants,
  standards,
}: {
  orgs: Org[];
  grants: Map<string, boolean>;
  standards: string[];
}) {
  const [selectedOrgId, setSelectedOrgId] = useState(orgs[0]?.id ?? null);
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

  if (orgs.length === 0) {
    return (
      <p style={{ marginTop: 20 }}>
        No organizations yet. They appear here once members are synced from Clerk.
      </p>
    );
  }

  const org = orgs.find((o) => o.id === selectedOrgId) ?? orgs[0];
  const members = org.members;

  const totalStandards = standards.length;
  const avgPct = members.length
    ? Math.round(
        members.reduce((sum, u) => {
          const done = standards.filter((c) => statusFor(u.progress.get(c)) === "Completed").length;
          return sum + (totalStandards ? Math.round((done / totalStandards) * 100) : 0);
        }, 0) / members.length,
      )
    : 0;
  const fullyCompliant = members.filter((u) => {
    if (totalStandards === 0) return false;
    return standards.every((c) => statusFor(u.progress.get(c)) === "Completed");
  }).length;

  return (
    <div>
      <div className="org-selector" role="tablist" aria-label="Organizations">
        {orgs.map((o) => (
          <button
            key={o.id}
            role="tab"
            aria-selected={o.id === org.id}
            className={`org-selector-btn ${o.id === org.id ? "active" : ""}`}
            onClick={() => {
              setSelectedOrgId(o.id);
              setExpanded(null);
            }}
          >
            {o.name}
            <span className="org-selector-count">{o.memberCount}</span>
          </button>
        ))}
      </div>

      <div className="org-stats">
        <div className="org-stat">
          <div className="org-stat-num">{members.length}</div>
          <div className="org-stat-label">Members in {org.name}</div>
        </div>
        <div className="org-stat" style={{ "--accent": "#0F6E56" } as React.CSSProperties}>
          <div className="org-stat-num">{avgPct}%</div>
          <div className="org-stat-label">Avg Completion</div>
        </div>
        <div className="org-stat" style={{ "--accent": "#16A34A" } as React.CSSProperties}>
          <div className="org-stat-num">{fullyCompliant}</div>
          <div className="org-stat-label">Fully Compliant</div>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="org-section">
          <div className="org-section-title">No members in this organization yet.</div>
        </div>
      ) : (
        <div className="admin-users">
          {members.map((u) => {
            const counts = { Completed: 0, "In Progress": 0, "Not Started": 0, "N/A": 0 } as Record<Status, number>;
            for (const code of standards) counts[statusFor(u.progress.get(code))] += 1;
            const done = counts.Completed;
            const pct = totalStandards ? Math.round((done / totalStandards) * 100) : 0;
            const granted = standards.filter((c) => grantMap.has(`${u.id}:${c}`)).length;
            const open = expanded === u.id;
            return (
              <div className="admin-user" key={u.id}>
                <div className="admin-user-head" onClick={() => setExpanded(open ? null : u.id)}>
                  <div className="admin-user-avatar">{initials(u.name, u.email)}</div>
                  <div>
                    <div className="admin-user-name">{u.name || "Unnamed user"}</div>
                    <div className="admin-user-email">{u.email || "no email"}</div>
                  </div>
                  <span className={`admin-pill ${u.orgRole === "admin" ? "admin-pill-available" : "admin-pill-draft"}`}>
                    {u.orgRole === "admin" ? "org admin" : "member"}
                  </span>
                  <span className="admin-pill admin-pill-draft">
                    access {granted}/{standards.length}
                  </span>
                  <div className="admin-user-progress">
                    <div className="admin-user-bar-wrap">
                      <div className="admin-user-bar" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="admin-user-pct">{pct}%</span>
                  </div>
                  <span className="admin-chevron">{open ? "▾" : "▸"}</span>
                </div>
                <div className="admin-user-stats">
                  {(["Completed", "In Progress", "Not Started"] as Status[]).map((s) => (
                    <span className="admin-user-stat" key={s}>
                      <span className="admin-user-stat-dot" style={{ background: STAT_COLORS[s] }} />
                      <b>{counts[s]}</b> {s}
                    </span>
                  ))}
                  {counts["N/A"] > 0 && (
                    <span className="admin-user-stat">
                      <span className="admin-user-stat-dot" style={{ background: STAT_COLORS["N/A"] }} />
                      <b>{counts["N/A"]}</b> N/A
                    </span>
                  )}
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
      )}
    </div>
  );
}