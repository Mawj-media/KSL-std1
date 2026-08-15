"use client";

import { useRouter } from "next/navigation";
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

const INPUT_STYLE: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #D1D5DB",
  fontSize: 14,
  minWidth: 220,
  color: "#111827",
};

const PRIMARY_BTN: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#0F6E56",
  color: "#FFFFFF",
  fontSize: 14,
  cursor: "pointer",
};

const SECONDARY_BTN: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #0F6E56",
  background: "#FFFFFF",
  color: "#0F6E56",
  fontSize: 14,
  cursor: "pointer",
};

export function OrgUsersConsole({
  orgs,
  grants,
  standards,
  currentUserId,
}: {
  orgs: Org[];
  grants: Map<string, boolean>;
  standards: string[];
  currentUserId: string | null;
}) {
  const [selectedOrgId, setSelectedOrgId] = useState(orgs[0]?.id ?? null);
  const [grantMap, setGrantMap] = useState(grants);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newOrgOpen, setNewOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgError, setNewOrgError] = useState<string | null>(null);
  const [newOrgNotice, setNewOrgNotice] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"org:admin" | "org:member">("org:member");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);
  const router = useRouter();

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

  async function createOrg() {
    setBusy(true);
    setNewOrgError(null);
    setNewOrgNotice(null);
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNewOrgError(data?.error ?? "Could not create organization");
        return;
      }
      const name = newOrgName.trim();
      setNewOrgNotice(`Organization "${name}" created.`);
      setNewOrgName("");
      setNewOrgOpen(false);
      router.refresh();
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        router.refresh();
      }
    } catch {
      setNewOrgError("Could not create organization");
    } finally {
      setBusy(false);
    }
  }

  async function sendInvite() {
    setBusy(true);
    setInviteError(null);
    setInviteNotice(null);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, orgId: org.id, orgRole: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data?.error ?? "Could not send invitation");
        return;
      }
      setInviteNotice(`Invitation sent to ${inviteEmail.trim()}.`);
      setInviteEmail("");
    } catch {
      setInviteError("Could not send invitation");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(user: Member) {
    const confirmed = window.confirm(
      `Delete ${user.name || user.email || "this user"} permanently?\n\nThis removes their account, progress, and access. This cannot be undone.`,
    );
    if (!confirmed) return;
    setBusy(true);
    setDeleteTarget(user.id);
    setDeleteError(null);
    setDeleteNotice(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data?.error ?? "Could not delete user");
        return;
      }
      setRemovedIds((prev) => new Set(prev).add(user.id));
      setDeleteNotice(`Deleted ${user.name || user.email || "user"}.`);
      router.refresh();
      for (let i = 0; i < 4; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        router.refresh();
      }
    } catch {
      setDeleteError("Could not delete user");
    } finally {
      setDeleteTarget(null);
      setBusy(false);
    }
  }

  const orgToolbar = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
      {newOrgOpen ? (
        <>
          <input
            type="text"
            placeholder="Organization name"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            disabled={busy}
            style={INPUT_STYLE}
          />
          <button
            onClick={createOrg}
            disabled={busy || !newOrgName.trim()}
            style={PRIMARY_BTN}
          >
            Create organization
          </button>
          <button
            onClick={() => {
              setNewOrgOpen(false);
              setNewOrgName("");
              setNewOrgError(null);
            }}
            disabled={busy}
            style={SECONDARY_BTN}
          >
            Cancel
          </button>
        </>
      ) : (
        <button onClick={() => setNewOrgOpen(true)} style={SECONDARY_BTN}>
          New organization
        </button>
      )}
    </div>
  );

  if (orgs.length === 0) {
    return (
      <div>
        {orgToolbar}
        {newOrgError && (
          <p style={{ color: "#DC2626", fontSize: 13, margin: "0 0 12px" }}>{newOrgError}</p>
        )}
        {newOrgNotice && (
          <p style={{ color: "#0F6E56", fontSize: 13, margin: "0 0 12px" }}>{newOrgNotice}</p>
        )}
        <p style={{ marginTop: 20 }}>
          No organizations yet. They appear here once members are synced from Clerk.
        </p>
      </div>
    );
  }

  const org = orgs.find((o) => o.id === selectedOrgId) ?? orgs[0];
  const members = org.members.filter((m) => !removedIds.has(m.id));

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
      {orgToolbar}
      {newOrgError && (
        <p style={{ color: "#DC2626", fontSize: 13, margin: "0 0 12px" }}>{newOrgError}</p>
      )}
      {newOrgNotice && (
        <p style={{ color: "#0F6E56", fontSize: 13, margin: "0 0 12px" }}>{newOrgNotice}</p>
      )}
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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
          background: "#F3F4F6",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
          Invite member to {org.name}
        </span>
        <input
          type="email"
          placeholder="name@company.com"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          disabled={busy}
          style={INPUT_STYLE}
        />
        <select
          value={inviteRole}
          onChange={(e) => setInviteRole(e.target.value as "org:admin" | "org:member")}
          disabled={busy}
          style={{ ...INPUT_STYLE, minWidth: 140 }}
        >
          <option value="org:member">Member</option>
          <option value="org:admin">Org admin</option>
        </select>
        <button
          onClick={sendInvite}
          disabled={busy || !inviteEmail.trim()}
          style={PRIMARY_BTN}
        >
          Send invite
        </button>
      </div>
      {inviteError && (
        <p style={{ color: "#DC2626", fontSize: 13, margin: "0 0 12px" }}>{inviteError}</p>
      )}
      {inviteNotice && (
        <p style={{ color: "#0F6E56", fontSize: 13, margin: "0 0 12px" }}>{inviteNotice}</p>
      )}
      {deleteError && (
        <p style={{ color: "#DC2626", fontSize: 13, margin: "0 0 12px" }}>{deleteError}</p>
      )}
      {deleteNotice && (
        <p style={{ color: "#0F6E56", fontSize: 13, margin: "0 0 12px" }}>{deleteNotice}</p>
      )}

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
                {open && u.role !== "admin" && u.id !== currentUserId && (
                  <div style={{ padding: "0 16px 14px" }}>
                    <button
                      onClick={() => removeMember(u)}
                      disabled={busy}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: "1px solid #DC2626",
                        background: "#FFFFFF",
                        color: "#DC2626",
                        fontSize: 13,
                        cursor: "pointer",
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      {deleteTarget === u.id ? "Deleting..." : "Remove user"}
                    </button>
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