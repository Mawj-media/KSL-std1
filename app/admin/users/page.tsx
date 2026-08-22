import { getSupabase, isSupabaseConfigured } from "../../../lib/supabase";
import { auth } from "@clerk/nextjs/server";
import { listOrganizationInvitations } from "../../../lib/clerk-admin";
import { OrgUsersConsole } from "./OrgUsersConsole";

export const dynamic = "force-dynamic";

type MemberRow = {
  organization_id: string;
  user_id: string;
  org_role: string;
  users: { name: string | null; email: string | null; role: string } | { name: string | null; email: string | null; role: string }[] | null;
};

type ProgressRow = { user_id: string; standard_code: string; status: string };

type InvitationRow = {
  id: string;
  email_address: string;
  role: string;
  status: string;
  created_at: string;
};

export default async function AdminUsersPage() {
  const { userId: currentUserId } = await auth();

  if (!isSupabaseConfigured()) {
    return (
      <div className="content">
        <div className="topbar-title">Organizations & Users</div>
        <p style={{ marginTop: 20 }}>Supabase is not configured yet.</p>
      </div>
    );
  }

  const [{ data: organizations }, { data: members }, { data: progress }, { data: grants }, { data: standards }] =
    await Promise.all([
      getSupabase()
        .from("organizations")
        .select("id, name")
        .order("created_at", { ascending: true }),
      getSupabase()
        .from("organization_members")
        .select("organization_id, user_id, org_role, users(name, email, role)")
        .order("joined_at", { ascending: true }),
      getSupabase().from("progress").select("user_id, standard_code, status"),
      getSupabase().from("access_grants").select("user_id, standard_code"),
      getSupabase().from("standards").select("code").eq("content_status", "published"),
    ]);

  const publishedCodes = (standards ?? []).map((s) => s.code).sort();
  const memberRows = (members ?? []) as MemberRow[];

  const progressByUser = new Map<string, Map<string, string>>();
  for (const p of (progress ?? []) as ProgressRow[]) {
    const userMap = progressByUser.get(p.user_id) ?? new Map<string, string>();
    userMap.set(p.standard_code, p.status);
    progressByUser.set(p.user_id, userMap);
  }

  // Fetch invitations for each org directly from Clerk BAPI
  const orgsWithInvitations = await Promise.all(
    (organizations ?? []).map(async (o) => {
      const rows = memberRows.filter((m) => m.organization_id === o.id);
      let invitations: InvitationRow[] = [];
      try {
        invitations = (await listOrganizationInvitations(o.id))
          .filter((inv) => inv.status !== "revoked");
      } catch {
        // Ignore invitation fetch errors
      }

      return {
        id: o.id,
        name: o.name,
        memberCount: rows.length,
        invitations,
        members: rows.map((m) => {
          const user = Array.isArray(m.users) ? m.users[0] : m.users;
          return {
            id: m.user_id,
            name: user?.name ?? null,
            email: user?.email ?? null,
            role: user?.role ?? "client",
            orgRole: m.org_role,
            progress: progressByUser.get(m.user_id) ?? new Map<string, string>(),
          };
        }),
      };
    })
  );

  return (
    <div className="content">
      <div className="topbar-title">Organizations & Users</div>
      <div className="topbar-sub">
        Switch organizations to review member completion and grant or revoke per-standard access.
      </div>
      <OrgUsersConsole
        orgs={orgsWithInvitations}
        grants={new Map((grants ?? []).map((g) => [`${g.user_id}:${g.standard_code}`, true]))}
        standards={publishedCodes}
        currentUserId={currentUserId ?? null}
      />
    </div>
  );
}