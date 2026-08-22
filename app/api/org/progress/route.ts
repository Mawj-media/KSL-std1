import { auth } from "@clerk/nextjs/server";
import { requireOrgAdmin } from "../../../../lib/auth";
import { getSupabase } from "../../../../lib/supabase";
import { canAccessStandardForOrg } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

type MemberRow = {
  user_id: string;
  org_role: string;
  users: { name: string | null; email: string | null }[] | null;
};

export async function GET() {
  let orgId: string;
  try {
    orgId = await requireOrgAdmin();
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
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

    return Response.json({
      org: org ?? { id: orgId, name: "Organization" },
      users: (members ?? []).map((m: MemberRow) => ({
        id: m.user_id,
        name: m.users?.[0]?.name ?? null,
        email: m.users?.[0]?.email ?? null,
        org_role: m.org_role,
      })),
      progress,
    });
  } catch (error) {
    console.error("Org progress fetch failed:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

const ALLOWED_STATUSES = ["not_started", "viewed", "completed", "na"] as const;

export async function PATCH(req: Request) {
  let orgId: string;
  try {
    orgId = await requireOrgAdmin();
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId: adminId } = await auth();

  let body: { userId?: unknown; standardCode?: unknown; status?: unknown; date?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { userId, standardCode, status, date } = body;

  if (
    typeof userId !== "string" ||
    typeof standardCode !== "string" ||
    typeof status !== "string" ||
    !ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])
  ) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  let dateIso: string | null = null;
  if (date !== undefined && date !== null) {
    if (typeof date !== "string" || Number.isNaN(Date.parse(date))) {
      return Response.json({ error: "Invalid date" }, { status: 400 });
    }
    dateIso = new Date(date).toISOString();
  }

  try {
    const { data: member } = await getSupabase()
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!member) {
      return Response.json({ error: "Target user is not a member of your organization" }, { status: 403 });
    }

    const { userId: adminId } = await auth();
    if (!adminId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasAccess = await canAccessStandardForOrg(userId, standardCode, { orgId, orgRole: "admin" });
    if (!hasAccess) {
      return Response.json({ error: "Target user does not have access to this standard" }, { status: 403 });
    }

    const now = new Date().toISOString();
    const targetDate = dateIso ?? now;

    const { data: existing } = await getSupabase()
      .from("progress")
      .select("viewed_at")
      .eq("user_id", userId)
      .eq("standard_code", standardCode)
      .maybeSingle();

    const viewedAt = existing?.viewed_at ?? targetDate;

    if (status === "not_started") {
      await getSupabase()
        .from("progress")
        .delete()
        .eq("user_id", userId)
        .eq("standard_code", standardCode);
    } else {
      const cols =
        status === "completed"
          ? { status: "completed", viewed_at: viewedAt, completed_at: targetDate }
          : status === "viewed"
            ? { status: "viewed", viewed_at: targetDate, completed_at: null }
            : { status: "na", viewed_at: viewedAt, completed_at: null };

      await getSupabase()
        .from("progress")
        .upsert({ user_id: userId, standard_code: standardCode, ...cols }, { onConflict: "user_id,standard_code" });
    }

    await getSupabase().from("activity_events").insert({
      user_id: adminId,
      event_type: "org_status_override",
      standard_code: standardCode,
      metadata: { target_user_id: userId, status },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Org progress override failed:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}