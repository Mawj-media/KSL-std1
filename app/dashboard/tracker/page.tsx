import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { STRUCTURE } from "../../../lib/standards";
import { getSupabase, isSupabaseConfigured } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

type ProgressRow = {
  standard_code: string;
  status: string;
  viewed_at: string | null;
  completed_at: string | null;
};

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

export default async function TrackerPage() {
  const { userId } = await auth();

  if (!isSupabaseConfigured() || !userId) {
    return <div className="content"><p>Tracker not available.</p></div>;
  }

  const { data } = await getSupabase()
    .from("progress")
    .select("standard_code, status, viewed_at, completed_at")
    .eq("user_id", userId);

  const map = new Map((data ?? []).map((p) => [p.standard_code, p as ProgressRow]));
  const all = Array.from(map.values());
  const viewed = all.length;
  const completed = all.filter((p) => p.status === "completed").length;
  const total = STRUCTURE.flatMap((d) => d.principles).flatMap((p) => p.standards).length;

  return (
    <div className="content">
      <div className="tracker-stats">
        <div className="tracker-stat">
          <div className="tracker-stat-num">{viewed}</div>
          <div className="tracker-stat-label">Viewed</div>
        </div>
        <div className="tracker-stat">
          <div className="tracker-stat-num">{completed}</div>
          <div className="tracker-stat-label">Completed</div>
        </div>
        <div className="tracker-stat">
          <div className="tracker-stat-num">{total}</div>
          <div className="tracker-stat-label">Total standards</div>
        </div>
      </div>
      <table className="tracker-table">
        <thead>
          <tr>
            <th>Standard</th>
            <th>Status</th>
            <th>Viewed</th>
            <th>Completed</th>
          </tr>
        </thead>
        <tbody>
          {STRUCTURE.map((d) =>
            d.principles.flatMap((p) =>
              p.standards.map((st) => {
                const row = map.get(st.slug);
                return (
                  <tr key={st.code}>
                    <td>
                      <span className="std-code">{st.code}</span>{" "}
                      {row ? (
                        <Link href={`/dashboard/standard/${st.slug}`} className="tracker-link">
                          {st.name}
                        </Link>
                      ) : (
                        st.name
                      )}
                    </td>
                    <td>
                      {row ? (
                        <span className={`std-status ${row.status === "completed" ? "ready" : "progress"}`}>
                          <span className="badge-dot" /> {row.status === "completed" ? "Completed" : "Viewed"}
                        </span>
                      ) : (
                        <span className="std-status soon"><span className="badge-dot" /> Not started</span>
                      )}
                    </td>
                    <td>{fmt(row?.viewed_at ?? null)}</td>
                    <td>{fmt(row?.completed_at ?? null)}</td>
                  </tr>
                );
              })
            )
          )}
        </tbody>
      </table>
    </div>
  );
}