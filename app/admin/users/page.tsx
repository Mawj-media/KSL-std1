import { getSupabase, isSupabaseConfigured } from "../../../lib/supabase";
import { UsersTable } from "./UsersTable";

export const dynamic = "force-dynamic";

type UserRow = { id: string; email: string | null; name: string | null; role: string };

export default async function AdminUsersPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="content">
        <div className="topbar-title">Users & Access</div>
        <p style={{ marginTop: 20 }}>Supabase is not configured yet.</p>
      </div>
    );
  }

  const [{ data: users }, { data: grants }, { data: standards }] = await Promise.all([
    getSupabase().from("users").select("id, email, name, role").order("created_at", { ascending: false }),
    getSupabase().from("access_grants").select("user_id, standard_code"),
    getSupabase().from("standards").select("code").eq("content_status", "published"),
  ]);

  const publishedCodes = (standards ?? []).map((s) => s.code).sort();

  return (
    <div className="content">
      <div className="topbar-title">Users & Access</div>
      <div className="topbar-sub">
        Grant or revoke per-standard access. Roles sync from Clerk.
      </div>
      <UsersTable
        users={(users ?? []) as UserRow[]}
        grants={new Map((grants ?? []).map((g) => [`${g.user_id}:${g.standard_code}`, true]))}
        standards={publishedCodes}
      />
    </div>
  );
}