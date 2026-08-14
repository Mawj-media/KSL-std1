import Link from "next/link";
import { STRUCTURE } from "../../../lib/standards";
import { getSupabase, isSupabaseConfigured } from "../../../lib/supabase";
import { ToggleAvailable } from "./ToggleAvailable";

export const dynamic = "force-dynamic";

type StandardRow = { code: string; content_status: string; available: boolean };

export default async function AdminStandardsPage() {
  let rows = new Map<string, StandardRow>();
  if (isSupabaseConfigured()) {
    const { data } = await getSupabase().from("standards").select("code, content_status, available");
    rows = new Map((data ?? []).map((r) => [r.code, r as StandardRow]));
  }

  return (
    <div className="content">
      <div className="admin-toolbar">
        <div>
          <div className="topbar-title">Standards</div>
          <div className="topbar-sub">Edit module content and availability</div>
        </div>
      </div>
      {STRUCTURE.map((domain) => (
        <div className="domain-block" key={domain.domain}>
          <div className="domain-h">{domain.domain}</div>
          {domain.principles.map((p) => (
            <div key={p.label}>
              <div className="principle-h">{p.label}</div>
              <div className="std-grid">
                {p.standards.map((st) => {
                  const row = rows.get(st.slug);
                  const status = row?.content_status ?? "none";
                  const available = row?.available ?? false;
                  return (
                    <div className="std-card" key={st.code}>
                      <span className="std-code">{st.code}</span>
                      <div className="std-name">{st.name}</div>
                      <div className="admin-status-row">
                        <span className={`admin-pill admin-pill-${status}`}>
                          {status === "published" ? "Published" : status === "draft" ? "Draft" : "No content"}
                        </span>
                        {available && <span className="admin-pill admin-pill-available">Available</span>}
                      </div>
                      <div className="admin-card-actions">
                        <Link className="admin-btn" href={`/admin/standards/${st.slug}`}>
                          Edit content
                        </Link>
                        <ToggleAvailable code={st.slug} available={available} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}