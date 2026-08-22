"use client";

import { useState, useEffect } from "react";

type ActivityEvent = {
  id: string;
  user_id: string;
  organization_id: string | null;
  event_type: string;
  standard_code: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type Meta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type ViewAs = "platform-admin" | "org-admin";

const EVENT_LABELS: Record<string, string> = {
  standard_granted: "Standard Granted",
  standard_revoked: "Standard Revoked",
  bulk_standard_granted: "Bulk Standard Granted",
  bulk_standard_revoked: "Bulk Standard Revoked",
  org_status_override: "Org Status Override",
  membership_removed: "Membership Removed",
  user_deleted: "User Deleted",
  user_email_updated: "User Email Updated",
  user_name_updated: "User Name Updated",
  role_changed: "Role Changed",
  email_add_rejected: "Email Add Rejected",
  module_viewed: "Module Viewed",
  quiz_passed: "Quiz Passed",
  quiz_failed: "Quiz Failed",
};

const EVENT_ICONS: Record<string, string> = {
  standard_granted: "✅",
  standard_revoked: "❌",
  bulk_standard_granted: "✅",
  bulk_standard_revoked: "❌",
  org_status_override: "🔄",
  membership_removed: "👤",
  user_deleted: "🗑️",
  user_email_updated: "📧",
  user_name_updated: "✏️",
  role_changed: "👑",
  email_add_rejected: "🚫",
  module_viewed: "👁️",
  quiz_passed: "🎯",
  quiz_failed: "⚠️",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMetadata(meta: Record<string, unknown>): string {
  const entries = Object.entries(meta).filter(([k]) => k !== "reason");
  if (entries.length === 0) return "";
  return entries
    .map(([k, v]) => {
      const key = k.replace(/_/g, " ");
      if (typeof v === "string" && v.startsWith("user_")) return `${key}: ${v.slice(0, 12)}...`;
      return `${key}: ${String(v)}`;
    })
    .join(", ");
}

export function ActivityLog({
  apiEndpoint,
  viewAs,
}: {
  apiEndpoint: string;
  viewAs: ViewAs;
}) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 50, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", "50");
        if (eventType) params.set("eventType", eventType);

        const res = await fetch(`${apiEndpoint}?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setEvents(json.data ?? []);
          setMeta(json.meta ?? { total: 0, page: 1, limit: 50, totalPages: 0 });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load activity");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [apiEndpoint, page, eventType, refreshKey]);

  const uniqueEventTypes = [...new Set(events.map((e) => e.event_type))].sort();

  function exportCSV() {
    const headers = ["Event", "User ID", "Standard", "Details", "Date"];
    const rows = events.map((e) => [
      EVENT_LABELS[e.event_type] ?? e.event_type,
      e.user_id,
      e.standard_code ?? "",
      formatMetadata(e.metadata),
      formatDate(e.created_at),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity_log.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="activity-log">
      <div className="activity-log__toolbar">
        <div className="activity-log__filters">
          <select
            value={eventType}
            onChange={(e) => { setEventType(e.target.value); setPage(1); }}
            className="activity-log__select"
          >
            <option value="">All Event Types</option>
            {uniqueEventTypes.map((t) => (
              <option key={t} value={t}>{EVENT_LABELS[t] ?? t}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="activity-log__refresh"
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
        {events.length > 0 && (
          <button onClick={exportCSV} className="activity-log__refresh">
            Export CSV
          </button>
        )}
      </div>

      {error && <div className="activity-log__error">{error}</div>}

      {!loading && events.length === 0 && (
        <div className="activity-log__empty">No activity events found.</div>
      )}

      {events.length > 0 && (
        <div className="activity-log__table-wrapper">
          <table className="activity-log__table">
            <thead>
              <tr>
                <th>Event</th>
                <th>User</th>
                <th>Standard</th>
                <th>Details</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>
                    <span className="activity-log__event-type">
                      <span className="activity-log__icon">{EVENT_ICONS[event.event_type] ?? "📌"}</span>
                      {EVENT_LABELS[event.event_type] ?? event.event_type}
                    </span>
                  </td>
                  <td>
                    <span className="activity-log__user-id">{event.user_id.slice(0, 12)}...</span>
                  </td>
                  <td>
                    {event.standard_code ? (
                      <span className="activity-log__standard">{event.standard_code}</span>
                    ) : (
                      <span className="activity-log__na">—</span>
                    )}
                  </td>
                  <td>
                    <span className="activity-log__meta">{formatMetadata(event.metadata)}</span>
                  </td>
                  <td>
                    <span className="activity-log__date">{formatDate(event.created_at)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="activity-log__pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="activity-log__page-btn"
          >
            Previous
          </button>
          <span className="activity-log__page-info">
            Page {meta.page} of {meta.totalPages} ({meta.total} events)
          </span>
          <button
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={page >= meta.totalPages}
            className="activity-log__page-btn"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
