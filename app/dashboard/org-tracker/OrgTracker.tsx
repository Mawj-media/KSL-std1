"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
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

const STANDARDS = STRUCTURE.flatMap((d) => d.principles).flatMap((p) => p.standards);

function statusFor(row: { status: string } | undefined): Status {
  if (!row) return "Not Started";
  if (row.status === "completed") return "Completed";
  if (row.status === "na") return "N/A";
  return "In Progress";
}

function statusDot(s: Status) {
  return {
    "Not Started": "#9CA3AF",
    "In Progress": "#F59E0B",
    Completed: "#16A34A",
    "N/A": "#D1D5DB",
  }[s];
}

function statusBadgeClass(s: Status) {
  return {
    "Not Started": "ot-badge--muted",
    "In Progress": "ot-badge--warning",
    Completed: "ot-badge--success",
    "N/A": "ot-badge--muted",
  }[s];
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function userInitials(name: string | null, email: string | null) {
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

function calcPct(userId: string, map: (userId: string, code: string) => OrgProgressRow | undefined): number {
  const total = STANDARDS.length;
  if (!total) return 0;
  const done = STANDARDS.filter((st) => statusFor(map(userId, st.code)) === "Completed").length;
  return Math.round((done / total) * 100);
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
    const lines = STANDARDS.map((st) => {
      const cells = users.map((u) => statusFor(map(u.id, st.code))).join(",");
      return `${st.code},"${st.name}",${cells},${overall(st.code)}`;
    });
    const csv = [header, ...lines].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "compliance_tracker.csv";
    a.click();
  };

  const totalDone = STANDARDS.filter((st) => overall(st.code) === "Completed").length;
  const totalInProgress = STANDARDS.filter((st) => overall(st.code) === "In Progress").length;
  const totalNa = STANDARDS.filter((st) => overall(st.code) === "N/A").length;
  const notStarted = STANDARDS.length - totalDone - totalInProgress - totalNa;
  const pct = STANDARDS.length ? Math.round((totalDone / STANDARDS.length) * 100) : 0;

  if (view === "dashboard") {
    return (
      <div className="content">
        <div className="ot-summary">
          <div className="ot-summary__header">
            <div className="ot-summary__org">{orgName}</div>
            <div className="ot-summary__subtitle">Compliance Overview</div>
          </div>
          <div className="ot-summary__metrics">
            <div className="ot-metric">
              <div className="ot-metric__ring" style={{ "--pct": `${pct}%`, "--color": "var(--color-brand)" } as CSSProperties}>
                <span className="ot-metric__value">{pct}%</span>
              </div>
              <div className="ot-metric__label">Overall</div>
            </div>
            <div className="ot-metric">
              <div className="ot-metric__number" style={{ color: "#16A34A" }}>{totalDone}</div>
              <div className="ot-metric__label">Completed</div>
            </div>
            <div className="ot-metric">
              <div className="ot-metric__number" style={{ color: "#F59E0B" }}>{totalInProgress}</div>
              <div className="ot-metric__label">In Progress</div>
            </div>
            <div className="ot-metric">
              <div className="ot-metric__number" style={{ color: "#9CA3AF" }}>{notStarted}</div>
              <div className="ot-metric__label">Not Started</div>
            </div>
          </div>
        </div>

        {error && <div className="org-error">{error}</div>}

        <div className="ot-card">
          <div className="ot-card__header">
            <div className="ot-card__title">Member Progress</div>
            <div className="ot-card__meta">{users.length} members</div>
          </div>
          <div className="ot-members">
            {users.map((u) => {
              const p = calcPct(u.id, map);
              return (
                <button key={u.id} className="ot-member" onClick={() => setView(`user-${u.id}`)}>
                  <div className="ot-member__avatar">{userInitials(u.name, u.email)}</div>
                  <div className="ot-member__info">
                    <div className="ot-member__name">{u.name || u.email || "—"}</div>
                    <div className="ot-member__bar-wrap">
                      <div
                        className="ot-member__bar"
                        style={{ width: `${p}%`, background: p === 100 ? "#16A34A" : p > 0 ? "#F59E0B" : "#D1D5DB" }}
                      />
                    </div>
                  </div>
                  <div className="ot-member__pct">{p}%</div>
                  <svg className="ot-member__chevron" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              );
            })}
          </div>
        </div>

        <div className="ot-card">
          <div className="ot-card__header">
            <div className="ot-card__title">Standards by Domain</div>
            <div className="ot-card__actions">
              <div className="ot-filter-group">
                {["All", ...STATUSES].map((f) => (
                  <button key={f} className={`ot-filter-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                    {f}
                  </button>
                ))}
              </div>
              <button className="ot-btn" onClick={exportCSV}>
                <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                  <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2M8 2v8m0 0l3-3m-3 3L5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Export
              </button>
            </div>
          </div>
          <div className="ot-domains">
            {STRUCTURE.map((domain) => (
              <DomainSection
                key={domain.domain}
                domain={domain}
                users={users}
                map={map}
                overall={overall}
                filter={filter}
                onUserClick={(userId) => setView(`user-${userId}`)}
                onOverride={(userId, code) => setPicker({ userId, code })}
              />
            ))}
          </div>
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
        <button className="ot-btn" onClick={() => setView("dashboard")}>Back to dashboard</button>
      </div>
    );
  }

  const done = STANDARDS.filter((st) => statusFor(map(user.id, st.code)) === "Completed").length;
  const inP = STANDARDS.filter((st) => statusFor(map(user.id, st.code)) === "In Progress").length;
  const na = STANDARDS.filter((st) => statusFor(map(user.id, st.code)) === "N/A").length;
  const userPctVal = STANDARDS.length ? Math.round((done / STANDARDS.length) * 100) : 0;

  return (
    <div className="content">
      <div className="ot-user-header">
        <button className="ot-back" onClick={() => setView("dashboard")}>
          <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
            <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to dashboard
        </button>
        <div className="ot-user-card">
          <div className="ot-user-card__avatar">{userInitials(user.name, user.email)}</div>
          <div className="ot-user-card__info">
            <div className="ot-user-card__name">{user.name || user.email || "Member"}</div>
            <div className="ot-user-card__meta">
              {user.email}
              {user.org_role === "admin" && <span className="ot-admin-badge">Org Admin</span>}
            </div>
          </div>
          <div className="ot-user-card__stats">
            <div className="ot-user-stat"><span className="ot-user-stat__val" style={{ color: "#16A34A" }}>{done}</span><span className="ot-user-stat__lbl">Done</span></div>
            <div className="ot-user-stat"><span className="ot-user-stat__val" style={{ color: "#F59E0B" }}>{inP}</span><span className="ot-user-stat__lbl">Active</span></div>
            <div className="ot-user-stat"><span className="ot-user-stat__val" style={{ color: "#9CA3AF" }}>{na}</span><span className="ot-user-stat__lbl">N/A</span></div>
            <div className="ot-user-stat"><span className="ot-user-stat__val" style={{ color: "var(--color-brand)" }}>{userPctVal}%</span><span className="ot-user-stat__lbl">Done</span></div>
          </div>
        </div>
      </div>

      {error && <div className="org-error">{error}</div>}

      <div className="ot-card">
        <div className="ot-card__header">
          <div className="ot-card__title">Standards Progress</div>
          <div className="ot-card__meta">{STANDARDS.length} standards</div>
        </div>
        <div className="ot-domains">
          {STRUCTURE.map((domain) => (
            <UserDomainSection
              key={domain.domain}
              domain={domain}
              user={user}
              map={map}
              onOverride={(code) => setPicker({ userId: user.id, code })}
            />
          ))}
        </div>
      </div>

      {picker && <OverridePicker saving={saving} onPick={applyOverride} onClose={() => setPicker(null)} />}
    </div>
  );
}

function DomainSection({
  domain,
  users,
  map,
  overall,
  filter,
  onUserClick,
  onOverride,
}: {
  domain: { domain: string; principles: { label: string; standards: { code: string; name: string }[] }[] };
  users: OrgUser[];
  map: (userId: string, code: string) => OrgProgressRow | undefined;
  overall: (code: string) => Status;
  filter: string;
  onUserClick: (userId: string) => void;
  onOverride: (userId: string, code: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const allStds = domain.principles.flatMap((p) => p.standards);
  const domainDone = allStds.filter((st) => overall(st.code) === "Completed").length;
  const domainTotal = allStds.length;
  const domainPct = domainTotal ? Math.round((domainDone / domainTotal) * 100) : 0;

  const anyVisible = domain.principles.some((p) =>
    p.standards.some((st) => filter === "All" || overall(st.code) === filter),
  );

  if (!anyVisible) return null;

  return (
    <div className="ot-domain">
      <button className="ot-domain__header" onClick={() => setExpanded(!expanded)}>
        <div className="ot-domain__left">
          <svg className={`ot-domain__chevron ${expanded ? "open" : ""}`} viewBox="0 0 16 16" fill="none" width="14" height="14">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="ot-domain__name">{domain.domain}</span>
        </div>
        <div className="ot-domain__right">
          <span className="ot-domain__stat">{domainDone}/{domainTotal}</span>
          <div className="ot-domain__bar-wrap">
            <div className="ot-domain__bar" style={{ width: `${domainPct}%` }} />
          </div>
        </div>
      </button>

      {expanded && (
        <div className="ot-domain__body">
          {domain.principles.map((principle) => {
            const pStds = principle.standards.filter((st) => filter === "All" || overall(st.code) === filter);
            if (!pStds.length) return null;
            return (
              <div className="ot-principle" key={principle.label}>
                <div className="ot-principle__label">{principle.label}</div>
                <div className="ot-std-grid">
                  <div className="ot-std-row ot-std-row--header">
                    <div className="ot-std-row__code">Ref</div>
                    <div className="ot-std-row__name">Standard</div>
                    <div className="ot-std-row__users">
                      {users.map((u) => (
                        <button key={u.id} className="ot-std-row__user" onClick={() => onUserClick(u.id)} title={u.name || u.email || ""}>
                          {userInitials(u.name, u.email)}
                        </button>
                      ))}
                    </div>
                    <div className="ot-std-row__status">Status</div>
                  </div>
                  {pStds.map((st) => (
                    <div className="ot-std-row" key={st.code}>
                      <div className="ot-std-row__code">{st.code}</div>
                      <div className="ot-std-row__name">{st.name}</div>
                      <div className="ot-std-row__users">
                        {users.map((u) => {
                          const s = statusFor(map(u.id, st.code));
                          return (
                            <button
                              key={u.id}
                              className={`ot-badge ${statusBadgeClass(s)}`}
                              onClick={() => onOverride(u.id, st.code)}
                              title={`${u.name || "User"}: ${s}`}
                            >
                              <span className="ot-badge__dot" style={{ background: statusDot(s) }} />
                            </button>
                          );
                        })}
                      </div>
                      <div className={`ot-badge ${statusBadgeClass(overall(st.code))}`}>
                        <span className="ot-badge__dot" style={{ background: statusDot(overall(st.code)) }} />
                        {overall(st.code)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UserDomainSection({
  domain,
  user,
  map,
  onOverride,
}: {
  domain: { domain: string; principles: { label: string; standards: { code: string; name: string }[] }[] };
  user: OrgUser;
  map: (userId: string, code: string) => OrgProgressRow | undefined;
  onOverride: (code: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const allStds = domain.principles.flatMap((p) => p.standards);
  const done = allStds.filter((st) => statusFor(map(user.id, st.code)) === "Completed").length;
  const total = allStds.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="ot-domain">
      <button className="ot-domain__header" onClick={() => setExpanded(!expanded)}>
        <div className="ot-domain__left">
          <svg className={`ot-domain__chevron ${expanded ? "open" : ""}`} viewBox="0 0 16 16" fill="none" width="14" height="14">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="ot-domain__name">{domain.domain}</span>
        </div>
        <div className="ot-domain__right">
          <span className="ot-domain__stat">{done}/{total}</span>
          <div className="ot-domain__bar-wrap">
            <div className="ot-domain__bar" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </button>

      {expanded && (
        <div className="ot-domain__body">
          {domain.principles.map((principle) => (
            <div className="ot-principle" key={principle.label}>
              <div className="ot-principle__label">{principle.label}</div>
              {principle.standards.map((st) => {
                const row = map(user.id, st.code);
                const s = statusFor(row);
                return (
                  <div className="ot-user-std" key={st.code}>
                    <div className="ot-user-std__code">{st.code}</div>
                    <div className="ot-user-std__name">{st.name}</div>
                    <button className={`ot-badge ${statusBadgeClass(s)}`} onClick={() => onOverride(st.code)} title="Click to change">
                      <span className="ot-badge__dot" style={{ background: statusDot(s) }} />
                      {s}
                    </button>
                    <div className="ot-user-std__dates">
                      {row?.viewed_at && <span>Viewed {fmt(row.viewed_at)}</span>}
                      {row?.completed_at && <span>Completed {fmt(row.completed_at)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
    <div className="ot-picker-overlay" onClick={onClose}>
      <div className="ot-picker" onClick={(e) => e.stopPropagation()}>
        <div className="ot-picker__title">Set Status</div>
        {STATUSES.map((s) => (
          <button key={s} className="ot-picker__option" disabled={saving} onClick={() => onPick(s)}>
            <span className="ot-picker__dot" style={{ background: statusDot(s) }} />
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
