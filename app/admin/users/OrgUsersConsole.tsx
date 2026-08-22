"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar } from "../../../components/ui/Avatar";
import { Badge } from "../../../components/ui/Badge";
import { Modal } from "../../../components/ui/Modal";

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

function userPct(u: Member, standards: string[]): number {
  const total = standards.length;
  if (!total) return 0;
  const done = standards.filter((c) => statusFor(u.progress.get(c)) === "Completed").length;
  return Math.round((done / total) * 100);
}

type Density = "default" | "compact";

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
  const router = useRouter();
  const [selectedOrgId, setSelectedOrgId] = useState(orgs[0]?.id ?? null);
  const [grantMap, setGrantMap] = useState(grants);
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "member">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "in-progress" | "not-started">("all");
  const [density, setDensity] = useState<Density>("default");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [editTarget, setEditTarget] = useState<Member | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newOrgOpen, setNewOrgOpen] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"org:admin" | "org:member">("org:member");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);

  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgError, setNewOrgError] = useState<string | null>(null);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const org = orgs.find((o) => o.id === selectedOrgId) ?? orgs[0];
  const totalStandards = standards.length;

  const filteredMembers = useMemo(() => {
    if (!org) return [];
    let list = org.members;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) => m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q),
      );
    }
    if (roleFilter === "admin") list = list.filter((m) => m.orgRole === "admin");
    else if (roleFilter === "member") list = list.filter((m) => m.orgRole !== "admin");
    if (statusFilter !== "all") {
      list = list.filter((m) => {
        const pct = userPct(m, standards);
        if (statusFilter === "completed") return pct === 100;
        if (statusFilter === "in-progress") return pct > 0 && pct < 100;
        return pct === 0;
      });
    }
    return list;
  }, [org, search, roleFilter, statusFilter, standards]);

  const allSelected = filteredMembers.length > 0 && filteredMembers.every((m) => selectedIds.has(m.id));

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredMembers.map((m) => m.id)));
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const avgPct = filteredMembers.length
    ? Math.round(filteredMembers.reduce((sum, u) => sum + userPct(u, standards), 0) / filteredMembers.length)
    : 0;
  const fullyCompliant = filteredMembers.filter((u) => {
    if (totalStandards === 0) return false;
    return standards.every((c) => statusFor(u.progress.get(c)) === "Completed");
  }).length;

  async function toggleGrant(userId: string, code: string, grant: boolean) {
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
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName }),
      });
      const data = await res.json();
      if (!res.ok) { setNewOrgError(data?.error ?? "Could not create organization"); return; }
      setNewOrgOpen(false);
      setNewOrgName("");
      router.refresh();
    } catch {
      setNewOrgError("Could not create organization");
    } finally {
      setBusy(false);
    }
  }

  async function sendInvite() {
    if (!org) return;
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
      if (!res.ok) { setInviteError(data?.error ?? "Could not send invitation"); return; }
      setInviteNotice(`Invitation sent to ${inviteEmail.trim()}.`);
      setInviteEmail("");
    } catch {
      setInviteError("Could not send invitation");
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(userId: string) {
    const user = org?.members.find((m) => m.id === userId);
    const confirmed = window.confirm(
      `Delete ${user?.name || user?.email || "this user"} permanently?\n\nThis removes their account, progress, and access. This cannot be undone.`,
    );
    if (!confirmed) return;
    setBusy(true);
    setDeleteTargetId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { alert(data?.error ?? "Could not delete user"); return; }
      setExpanded(null);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(userId); return n; });
      router.refresh();
    } catch {
      alert("Could not delete user");
    } finally {
      setDeleteTargetId(null);
      setBusy(false);
    }
  }

  async function changeRole(userId: string, orgRole: "org:admin" | "org:member") {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgRole, orgId: org?.id }),
      });
      if (res.ok) { setEditTarget(null); router.refresh(); }
    } finally {
      setBusy(false);
    }
  }

  async function bulkDelete() {
    const confirmed = window.confirm(`Delete ${selectedIds.size} user(s) permanently?`);
    if (!confirmed) return;
    setBusy(true);
    try {
      for (const id of selectedIds) {
        await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      }
      setSelectedIds(new Set());
      setExpanded(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function openEditModal(m: Member) {
    const parts = (m.name ?? "").split(" ");
    setEditFirstName(parts[0] ?? "");
    setEditLastName(parts.slice(1).join(" "));
    setEditTarget(m);
  }

  if (orgs.length === 0) {
    return (
      <div>
        <div className="org-toolbar">
          <div className="org-toolbar__left">
            <button className="btn-primary" onClick={() => setNewOrgOpen(true)}>
              New organization
            </button>
          </div>
        </div>
        <Modal open={newOrgOpen} onClose={() => setNewOrgOpen(false)} title="New organization">
          {newOrgError && <div className="modal__error">{newOrgError}</div>}
          <div className="modal__field">
            <label className="modal__label">Organization name</label>
            <input
              className="modal__input"
              type="text"
              placeholder="e.g. Acme Corp"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="modal__footer" style={{ padding: 0 }}>
            <button className="btn-secondary" onClick={() => { setNewOrgOpen(false); setNewOrgName(""); setNewOrgError(null); }} disabled={busy}>Cancel</button>
            <button className="btn-primary" onClick={createOrg} disabled={busy || !newOrgName.trim()}>Create</button>
          </div>
        </Modal>
        <p style={{ marginTop: 20, color: "var(--color-text-muted)" }}>
          No organizations yet. Create one to get started.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="org-toolbar">
        <div className="org-toolbar__left">
          <button className="btn-primary" onClick={() => setNewOrgOpen(true)}>
            + New org
          </button>
          <button className="btn-secondary" onClick={() => setInviteOpen(true)}>
            + Invite member
          </button>
        </div>
        <div className="org-toolbar__right">
          {selectedIds.size > 0 && (
            <button className="bulk-toolbar__btn bulk-toolbar__btn--danger" onClick={bulkDelete} disabled={busy}>
              Delete {selectedIds.size} selected
            </button>
          )}
        </div>
      </div>

      <div className="org-selector" role="tablist" aria-label="Organizations">
        {orgs.map((o) => (
          <button
            key={o.id}
            role="tab"
            aria-selected={o.id === org.id}
            className={`org-selector-btn ${o.id === org.id ? "active" : ""}`}
            onClick={() => { setSelectedOrgId(o.id); setExpanded(null); setSelectedIds(new Set()); setSearch(""); }}
          >
            {o.name}
            <span className="org-selector-count">{o.memberCount}</span>
          </button>
        ))}
      </div>

      <div className="org-stats">
        <div className="org-stat">
          <div className="org-stat-num">{filteredMembers.length}</div>
          <div className="org-stat-label">Members</div>
        </div>
        <div className="org-stat">
          <div className="org-stat-num">{avgPct}%</div>
          <div className="org-stat-label">Avg Completion</div>
        </div>
        <div className="org-stat">
          <div className="org-stat-num">{fullyCompliant}</div>
          <div className="org-stat-label">Fully Compliant</div>
        </div>
      </div>

      <div className="search-filter-bar">
        <div className="search-filter-bar__search">
          <svg viewBox="0 0 16 16" fill="none"><path d="M11.5 7a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM10.3 10.8l3.4 3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <input placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="search-filter-bar__select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}>
          <option value="all">All roles</option>
          <option value="admin">Org admins</option>
          <option value="member">Members</option>
        </select>
        <select className="search-filter-bar__select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="all">All progress</option>
          <option value="completed">Completed</option>
          <option value="in-progress">In progress</option>
          <option value="not-started">Not started</option>
        </select>
        <div className="search-filter-bar__density">
          <button className={`search-filter-bar__density-btn ${density === "default" ? "active" : ""}`} onClick={() => setDensity("default")}>Default</button>
          <button className={`search-filter-bar__density-btn ${density === "compact" ? "active" : ""}`} onClick={() => setDensity("compact")}>Compact</button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bulk-toolbar">
          <span className="bulk-toolbar__count">{selectedIds.size} selected</span>
          <div className="bulk-toolbar__actions">
            <button className="bulk-toolbar__btn bulk-toolbar__btn--danger" onClick={bulkDelete} disabled={busy}>Delete selected</button>
          </div>
        </div>
      )}

      {filteredMembers.length === 0 ? (
        <div className="org-section">
          <div className="org-section-title">
            {search || roleFilter !== "all" || statusFilter !== "all" ? "No members match your filters." : "No members in this organization yet."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: density === "compact" ? 4 : 8 }}>
          {filteredMembers.map((u) => {
            const pct = userPct(u, standards);
            const granted = standards.filter((c) => grantMap.has(`${u.id}:${c}`)).length;
            const open = expanded === u.id;
            const counts: Record<Status, number> = { Completed: 0, "In Progress": 0, "Not Started": 0, "N/A": 0 };
            for (const code of standards) counts[statusFor(u.progress.get(code))] += 1;

            return (
              <div key={u.id}>
                <div
                  className={`member-row ${open ? "member-row--expanded" : ""} ${selectedIds.has(u.id) ? "member-row--selected" : ""}`}
                  onClick={() => setExpanded(open ? null : u.id)}
                  style={density === "compact" ? { padding: "6px 12px" } : undefined}
                >
                  <input
                    type="checkbox"
                    className="member-row__checkbox"
                    checked={selectedIds.has(u.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSelect(u.id)}
                  />
                  <Avatar name={u.name} email={u.email} size={density === "compact" ? 30 : 36} />
                  <div className="member-row__info">
                    <div className="member-row__name">{u.name || "Unnamed user"}</div>
                    <div className="member-row__email">{u.email || "no email"}</div>
                  </div>
                  <Badge variant={u.orgRole === "admin" ? "admin" : "member"}>
                    {u.orgRole === "admin" ? "org admin" : "member"}
                  </Badge>
                  <div className="member-row__progress">
                    <div className="member-row__bar-wrap">
                      <div className="member-row__bar" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="member-row__pct">{pct}%</span>
                  </div>
                  <Badge variant={pct === 100 ? "completed" : pct > 0 ? "in-progress" : "not-started"}>
                    {granted}/{totalStandards} access
                  </Badge>
                  <div className="member-row__chevron">
                    <svg viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>

                {open && (
                  <>
                    <div className="member-panel">
                      <div className="member-panel__section">
                        <div className="member-panel__label">Standard Access Grants</div>
                        <div className="member-panel__grid">
                          {standards.map((code) => {
                            const has = grantMap.has(`${u.id}:${code}`);
                            return (
                              <label className="member-panel__checkbox" key={code}>
                                <input
                                  type="checkbox"
                                  checked={has}
                                  disabled={busy || u.role === "admin"}
                                  onChange={(e) => toggleGrant(u.id, code, e.target.checked)}
                                />
                                {code}
                              </label>
                            );
                          })}
                          {standards.length === 0 && <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>No published standards yet.</span>}
                        </div>
                      </div>
                      <div className="member-panel__section">
                        <div className="member-panel__label">Progress</div>
                        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                          {(["Completed", "In Progress", "Not Started"] as Status[]).map((s) => (
                            <span className="admin-user-stat" key={s}>
                              <span className="admin-user-stat-dot" style={{ background: s === "Completed" ? "var(--color-brand)" : s === "In Progress" ? "var(--color-warning)" : "var(--color-text-muted)" }} />
                              <b>{counts[s]}</b> {s}
                            </span>
                          ))}
                          {counts["N/A"] > 0 && (
                            <span className="admin-user-stat">
                              <span className="admin-user-stat-dot" style={{ background: "var(--color-border)" }} />
                              <b>{counts["N/A"]}</b> N/A
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="member-panel__actions">
                        <button className="member-panel__btn" onClick={(e) => { e.stopPropagation(); openEditModal(u); }}>
                          Edit user
                        </button>
                        {u.id !== currentUserId && u.role !== "admin" && (
                          <button
                            className="member-panel__btn member-panel__btn--danger"
                            onClick={(e) => { e.stopPropagation(); deleteUser(u.id); }}
                            disabled={busy}
                          >
                            {deleteTargetId === u.id ? "Deleting..." : "Remove user"}
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Org Modal */}
      <Modal open={newOrgOpen} onClose={() => setNewOrgOpen(false)} title="New organization">
        {newOrgError && <div className="modal__error">{newOrgError}</div>}
        <div className="modal__field">
          <label className="modal__label">Organization name</label>
          <input className="modal__input" type="text" placeholder="e.g. Acme Corp" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} disabled={busy} />
        </div>
        <div className="modal__footer" style={{ padding: 0 }}>
          <button className="btn-secondary" onClick={() => { setNewOrgOpen(false); setNewOrgName(""); setNewOrgError(null); }} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={createOrg} disabled={busy || !newOrgName.trim()}>Create</button>
        </div>
      </Modal>

      {/* Invite Modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title={`Invite member to ${org?.name ?? ""}`}>
        {inviteError && <div className="modal__error">{inviteError}</div>}
        {inviteNotice && <div className="modal__notice">{inviteNotice}</div>}
        <div className="modal__field">
          <label className="modal__label">Email address</label>
          <input className="modal__input" type="email" placeholder="name@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} disabled={busy} />
        </div>
        <div className="modal__field">
          <label className="modal__label">Role</label>
          <select className="modal__select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)} disabled={busy}>
            <option value="org:member">Member</option>
            <option value="org:admin">Org admin</option>
          </select>
        </div>
        <div className="modal__footer" style={{ padding: 0 }}>
          <button className="btn-secondary" onClick={() => { setInviteOpen(false); setInviteEmail(""); setInviteError(null); setInviteNotice(null); }} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={sendInvite} disabled={busy || !inviteEmail.trim()}>Send invite</button>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit user">
        {editTarget && (
          <>
            <div className="modal__field">
              <label className="modal__label">First name</label>
              <input className="modal__input" type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} disabled={busy} />
            </div>
            <div className="modal__field">
              <label className="modal__label">Last name</label>
              <input className="modal__input" type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} disabled={busy} />
            </div>
            <div className="modal__field">
              <label className="modal__label">Organization role</label>
              <select className="modal__select" value={editTarget.orgRole === "admin" ? "org:admin" : "org:member"} onChange={(e) => changeRole(editTarget.id, e.target.value as "org:admin" | "org:member")} disabled={busy}>
                <option value="org:member">Member</option>
                <option value="org:admin">Org admin</option>
              </select>
            </div>
            <div className="modal__field">
              <label className="modal__label">Email</label>
              <div className="modal__help">{editTarget.email}</div>
            </div>
          </>
        )}
      </Modal>

    </div>
  );
}
