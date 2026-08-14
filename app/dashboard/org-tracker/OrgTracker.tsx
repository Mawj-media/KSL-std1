"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { STRUCTURE } from "../../../lib/standards";

export type OrgUser = {
  id: string;
  name: string | null;
  email: string | null;
  org_role: string;
};

export type OrgProgressRow = {
  user_id: string;
  standard_code: string;
  status: string;
  viewed_at: string | null;
  completed_at: string | null;
};

type Status = "Not Started" | "In Progress" | "Completed" | "N/A";
type View = "dashboard" | `user-${string}`;

const STATUSES: Status[] = ["Not Started", "In Progress", "Completed", "N/A"];
const FILTERS = ["All", ...STATUSES];

const STANDARDS = STRUCTURE.flatMap((d) => d.principles).flatMap((p) => p.standards);

function statusFor(row: { status: string } | undefined): Status {
  if (!row) return "Not Started";
  if (row.status === "completed") return "Completed";
  if (row.status === "na") return "N/A";
  return "In Progress";
}

function statusClass(s: Status) {
  return {
    "Not Started": "org-s-not-started",
    "In Progress": "org-s-in-progress",
    Completed: "org-s-completed",
    "N/A": "org-s-na",
  }[s];
}

function statusDot(s: Status) {
  return {
    "Not Started": "#9CA3AF",
    "In Progress": "#F59E0B",
    Completed: "#16A34A",
    "N/A": "#D1D5DB",
  }[s];
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
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

export function OrgTracker({
  orgName,
  users: initialUsers,
  progress: initialProgress,
}: {
  orgName: string;
  users: OrgUser[];
  progress: OrgProgressRow[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [progress, setProgress] = useState(initialProgress);
  const [view, setView] = useState<View>("dashboard");
  const [filter, setFilter] = useState<string>("All");
  const [picker, setPicker] = useState<{ userId: string; code: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/org/progress", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setUsers(data.users ?? []);
      setProgress(data.progress ?? []);
      setError(null);
    } catch {
      setError("Failed to refresh progress");
    }
  }, []);

  useEffect(() => {
    if (view === "dashboard") setFilter("All");
  }, [view]);

  const map = useCallback(
    (userId: string, code: string) => {
      return progress.find((p) => p.user_id === userId && p.standard_code === code);
    },
    [progress],
  );

  const overall = useCallback(
    (code: string) => {
      const ss = users.map((u) => statusFor(map(u.id, code)));
      if (ss.length === 0) return "Not Started" as Status;
      if (ss.every((s) => s === "Completed")) return "Completed";
      if (ss.every((s) => s === "N/A")) return "N/A";
      if (ss.some((s) => s === "Completed" || s === "In Progress")) return "In Progress";
      return "Not Started";
    },
    [users, map],
  );

  const applyOverride = async (status: Status) => {
    if (!picker || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/org/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: picker.userId,
          standardCode: picker.code,
          status:
            status === "Not Started" ? "not_started" : status === "In Progress" ? "viewed" : status === "N/A" ? "na" : "completed",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Override failed");
      }
      setPicker(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Override failed");
    } finally {
      setSaving(false);
    }
  };

  const exportCSV = () => {
    const header =
      "Standard Ref,Standard Name," + users.map((u) => u.name || u.email || u.id).join(",") + ",Overall";
    const lines = STRUCTURE.flatMap((d) => d.principles).flatMap((p) => p.standards).map((st) => {
      const cells = users.map((u) => statusFor(map(u.id, st.code))).join(",");
      return `${st.code},"${st.name}",${cells},${overall(st.code)}`;
    });
    const csv = [header, ...lines].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "compliance_tracker.csv";
    a.click();
  };

  const badge = (s: Status, clickable: boolean, userId: string, code: string) => (
    <button
      className={`org-badge ${statusClass(s)}`}
      disabled={!clickable}
      onClick={() => clickable && setPicker({ userId, code })}
      title={clickable ? "Change status" : undefined}
    >
      <span className="org-badge-dot" style={{ background: statusDot(s) }} />
      {s}
    </button>
  );

  const totalDone = STANDARDS.filter((st) => overall(st.code) === "Completed").length;
  const totalInProgress = STANDARDS.filter((st) => overall(st.code) === "In Progress").length;
  const totalNa = STANDARDS.filter((st) => overall(st.code) === "N/A").length;
  const pct = STANDARDS.length ? Math.round((totalDone / STANDARDS.length) * 100) : 0;

  if (view === "dashboard") {
    const progBars = users.map((u) => {
      const done = STANDARDS.filter((st) => statusFor(map(u.id, st.code)) === "Completed").length;
      const p = STANDARDS.length ? Math.round((done / STANDARDS.length) * 100) : 0;
      return (
        <div className="org-cp-row" key={u.id}>
          <div className="org-cp-name">{u.name || u.email || "—"}</div>
          <div className="org-cp-bar-wrap">
            <div className="org-cp-bar" style={{ width: `${p}%` }} />
          </div>
          <div className="org-cp-pct">{p}%</div>
        </div>
      );
    });

    let tableRows = "";
    STRUCTURE.forEach((domain) => {
      const anyVisible = domain.principles.some((p) =>
        p.standards.some((st) => filter === "All" || overall(st.code) === filter),
      );
      if (!anyVisible) return;
      tableRows += `<tr class="org-domain-row"><td colspan="${2 + users.length}">${domain.domain}</td></tr>`;
      domain.principles.forEach((principle) => {
        const pStds = principle.standards.filter((st) => filter === "All" || overall(st.code) === filter);
        if (!pStds.length) return;
        tableRows += `<tr class="org-principle-row"><td colspan="${2 + users.length}">${principle.label}</td></tr>`;
        pStds.forEach((st) => {
          const userCells = users
            .map((u) => `<td>${badgeHtml(statusFor(map(u.id, st.code)))}</td>`)
            .join("");
          tableRows += `<tr><td><span class="std-code">${st.code}</span></td><td>${st.name}</td>${userCells}<td>${badgeHtml(overall(st.code))}</td></tr>`;
        });
      });
    });

    return (
      <div className="content">
        <div className="org-stats">
          <div className="org-stat">
            <div className="org-stat-num">{STANDARDS.length}</div>
            <div className="org-stat-label">Total Standards</div>
          </div>
          <div className="org-stat" style={{ "--accent": "#16A34A" } as CSSProperties}>
            <div className="org-stat-num">{totalDone}</div>
            <div className="org-stat-label">Fully Complete</div>
          </div>
          <div className="org-stat" style={{ "--accent": "#F59E0B" } as CSSProperties}>
            <div className="org-stat-num">{totalInProgress}</div>
            <div className="org-stat-label">In Progress</div>
          </div>
          <div className="org-stat" style={{ "--accent": "#9CA3AF" } as CSSProperties}>
            <div className="org-stat-num">{totalNa}</div>
            <div className="org-stat-label">Not Applicable</div>
          </div>
          <div className="org-stat" style={{ "--accent": "#0F6E56" } as CSSProperties}>
            <div className="org-stat-num">{pct}%</div>
            <div className="org-stat-label">Overall Progress</div>
          </div>
        </div>

        <div className="org-section">
          <div className="org-section-title">Completion by member</div>
          {progBars}
        </div>

        {error && <div className="org-error">{error}</div>}

        <div className="org-table-wrap">
          <div className="org-table-toolbar">
            <div className="org-table-toolbar-title">
              {orgName} — all {STANDARDS.length} standards
            </div>
            <div className="org-filter-group">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  className={`org-filter-btn ${filter === f ? "active" : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="org-table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Standard</th>
                  {users.map((u) => (
                    <th key={u.id} className="org-user-head" onClick={() => setView(`user-${u.id}`)}>
                      {u.name || u.email || "—"}
                    </th>
                  ))}
                  <th>Overall</th>
                </tr>
              </thead>
              <tbody dangerouslySetInnerHTML={{ __html: tableRows }} />
            </table>
          </div>
        </div>

        <div className="org-actions">
          <button className="btn btn-ghost" onClick={exportCSV}>
            ↓ Export CSV
          </button>
        </div>

        {picker && <OverridePicker saving={saving} onPick={applyOverride} onClose={() => setPicker(null)} />}
      </div>
    );
  }

  const userId = view.slice(5);
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return (
      <div className="content">
        <div className="org-error">Member not found.</div>
        <button className="btn btn-ghost" onClick={() => setView("dashboard")}>
          ← Back to dashboard
        </button>
      </div>
    );
  }

  const done = STANDARDS.filter((st) => statusFor(map(user.id, st.code)) === "Completed").length;
  const inP = STANDARDS.filter((st) => statusFor(map(user.id, st.code)) === "In Progress").length;
  const na = STANDARDS.filter((st) => statusFor(map(user.id, st.code)) === "N/A").length;
  const userPct = STANDARDS.length ? Math.round((done / STANDARDS.length) * 100) : 0;

  const rows = STRUCTURE.map((domain) => (
    <tbody key={domain.domain}>
      <tr className="org-domain-row">
        <td colSpan={5}>{domain.domain}</td>
      </tr>
      {domain.principles.map((principle) => (
        <FragmentRows
          key={principle.label}
          principle={principle}
          user={user}
          map={map}
          badge={badge}
        />
      ))}
    </tbody>
  ));

  return (
    <div className="content">
      <div className="org-ind-header">
        <div className="org-ind-avatar">{initials(user.name, user.email)}</div>
        <div>
          <div className="org-ind-name">{user.name || user.email || "Member"}</div>
          <div className="org-ind-role">
            {user.email ?? ""}
            {user.org_role === "admin" ? " · Org admin" : ""}
          </div>
        </div>
      </div>
      <div className="org-ind-stats">
        <div className="org-ind-stat">
          <div className="org-ind-stat-val" style={{ color: "#16A34A" }}>{done}</div>
          <div className="org-ind-stat-lbl">Completed</div>
        </div>
        <div className="org-ind-stat">
          <div className="org-ind-stat-val" style={{ color: "#F59E0B" }}>{inP}</div>
          <div className="org-ind-stat-lbl">In Progress</div>
        </div>
        <div className="org-ind-stat">
          <div className="org-ind-stat-val" style={{ color: "#9CA3AF" }}>{na}</div>
          <div className="org-ind-stat-lbl">Not Applicable</div>
        </div>
        <div className="org-ind-stat">
          <div className="org-ind-stat-val" style={{ color: "#0F6E56" }}>{userPct}%</div>
          <div className="org-ind-stat-lbl">Complete</div>
        </div>
      </div>

      {error && <div className="org-error">{error}</div>}

      <div className="org-table-wrap">
        <div className="org-table-toolbar">
          <div className="org-table-toolbar-title">
            {(user.name || user.email || "Member") + " — all " + STANDARDS.length + " standards"}
          </div>
          <button className="btn btn-ghost" onClick={() => setView("dashboard")}>
            ← Back to dashboard
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="org-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Standard</th>
                <th>Status</th>
                <th>Viewed</th>
                <th>Completed</th>
              </tr>
            </thead>
            {rows}
          </table>
        </div>
      </div>

      {picker && <OverridePicker saving={saving} onPick={applyOverride} onClose={() => setPicker(null)} />}
    </div>
  );
}

function FragmentRows({
  principle,
  user,
  map,
  badge,
}: {
  principle: { label: string; standards: { code: string; name: string }[] };
  user: OrgUser;
  map: (userId: string, code: string) => OrgProgressRow | undefined;
  badge: (s: Status, clickable: boolean, userId: string, code: string) => ReactNode;
}) {
  return (
    <>
      <tr className="org-principle-row">
        <td colSpan={5}>{principle.label}</td>
      </tr>
      {principle.standards.map((st) => {
        const row = map(user.id, st.code);
        return (
          <tr key={st.code}>
            <td>
              <span className="std-code">{st.code}</span>
            </td>
            <td>{st.name}</td>
            <td>{badge(statusFor(row), true, user.id, st.code)}</td>
            <td>{fmt(row?.viewed_at ?? null)}</td>
            <td>{fmt(row?.completed_at ?? null)}</td>
          </tr>
        );
      })}
    </>
  );
}

function badgeHtml(s: Status) {
  const cls = statusClass(s);
  const dot = statusDot(s);
  return `<button class="org-badge ${cls}" style="cursor:default" tabindex="-1"><span class="org-badge-dot" style="background:${dot}"></span>${s}</button>`;
}

function OverridePicker({
  saving,
  onPick,
  onClose,
}: {
  saving: boolean;
  onPick: (s: Status) => void;
  onClose: () => void;
}) {
  return (
    <div className="org-picker-overlay" onClick={onClose}>
      <div className="org-picker-menu" onClick={(e) => e.stopPropagation()}>
        {STATUSES.map((s) => (
          <button key={s} className="org-picker-option" disabled={saving} onClick={() => onPick(s)}>
            <span className="org-picker-dot" style={{ background: statusDot(s) }} />
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}