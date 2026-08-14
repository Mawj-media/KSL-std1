import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { currentOrgContext } from "../../../lib/auth";
import { getSupabase, isSupabaseConfigured } from "../../../lib/supabase";
import { OrgTracker } from "./OrgTracker";

export const dynamic = "force-dynamic";

type MemberRow = {
  user_id: string;
  org_role: string;
  users: { name: string | null; email: string | null }[] | null;
};

export default async function OrgTrackerPage() {
  const { userId } = await auth();
  if (!userId || !isSupabaseConfigured()) redirect("/dashboard");

  const orgContext = await currentOrgContext();
  if (!orgContext || orgContext.orgRole !== "admin") redirect("/dashboard");
  const orgId = orgContext.orgId;

  const [{ data: org }, { data: members }] = await Promise.all([
    getSupabase().from("organizations").select("id, name").eq("id", orgId).maybeSingle(),
    getSupabase()
      .from("organization_members")
      .select("user_id, org_role, users(name, email)")
      .eq("organization_id", orgId)
      .order("joined_at", { ascending: true }),
  ]);

  const userIds = (members ?? []).map((m: MemberRow) => m.user_id);

  let progress: unknown[] = [];
  if (userIds.length > 0) {
    const { data } = await getSupabase()
      .from("progress")
      .select("user_id, standard_code, status, viewed_at, completed_at")
      .in("user_id", userIds);
    progress = data ?? [];
  }

  return (
    <OrgTracker
      orgName={org?.name ?? "Organization"}
      users={(members ?? []).map((m: MemberRow) => ({
        id: m.user_id,
        name: m.users?.[0]?.name ?? null,
        email: m.users?.[0]?.email ?? null,
        org_role: m.org_role,
      }))}
      progress={progress as { user_id: string; standard_code: string; status: string; viewed_at: string | null; completed_at: string | null }[]}
    />
  );
}