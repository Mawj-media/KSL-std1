import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { STRUCTURE } from "../../lib/standards";
import { getSupabase, isSupabaseConfigured } from "../../lib/supabase";

export const dynamic = "force-dynamic";

type StandardRow = { code: string; content_status: string; available: boolean };
type ProgressRow = { standard_code: string; status: string };

export default async function Dashboard() {
  const { userId } = await auth();

  let rows = new Map<string, StandardRow>();
  let progress = new Map<string, string>();
  if (isSupabaseConfigured()) {
    const [{ data: stds }, { data: prog }] = await Promise.all([
      getSupabase().from("standards").select("code, content_status, available"),
      userId
        ? getSupabase().from("progress").select("standard_code, status").eq("user_id", userId)
        : Promise.resolve({ data: [] as ProgressRow[] }),
    ]);
    rows = new Map((stds ?? []).map((r) => [r.code, r as StandardRow]));
    progress = new Map((prog ?? []).map((p) => [p.standard_code, p.status]));
  }

  return (
    <div className="content">
      {STRUCTURE.map((domain) => (
        <div className="domain-block" key={domain.domain}>
          <div className="domain-h">{domain.domain}</div>
          {domain.principles.map((p) => (
            <div key={p.label}>
              <div className="principle-h">{p.label}</div>
              <div className="std-grid">
                {p.standards.map((st) => {
                  const row = rows.get(st.slug);
                  const available =
                    row?.available ?? (isSupabaseConfigured() ? false : st.available);
                  const published =
                    !isSupabaseConfigured() || row?.content_status === "published";
                  const status = progress.get(st.slug);
                  const openable = available && published;
                  const inner = (
                    <>
                      <span className="std-code">{st.code}</span>
                      <div className="std-name">{st.name}</div>
                      {status ? (
                        <span className={`std-status ${status === "completed" ? "ready" : "progress"}`}>
                          <span className="badge-dot" />
                          {status === "completed" ? "Completed" : "Viewed"}
                        </span>
                      ) : openable ? (
                        <span className="std-status ready"><span className="badge-dot" /> Open module</span>
                      ) : (
                        <span className="std-status soon"><span className="badge-dot" /> Coming soon</span>
                      )}
                    </>
                  );
                  return openable ? (
                    <Link key={st.code} href={`/dashboard/standard/${st.slug}`} className="std-card available">
                      {inner}
                    </Link>
                  ) : (
                    <div key={st.code} className="std-card soon">{inner}</div>
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