import { requireAdmin } from "../../../../../../lib/auth";
import { ClerkApiError, updateMembershipRole } from "../../../../../../lib/clerk-admin";
import { getSupabase } from "../../../../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  if (!/^user_[A-Za-z0-9]+$/.test(userId)) {
    return Response.json({ error: "Invalid user id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { orgRole, orgId } = (body ?? {}) as { orgRole?: string; orgId?: string };

  if (orgRole !== "org:admin" && orgRole !== "org:member") {
    return Response.json({ error: "Role must be org:admin or org:member" }, { status: 400 });
  }

  // Get the org from Supabase if not provided
  let targetOrgId = orgId;
  if (!targetOrgId) {
    const { data: membership } = await getSupabase()
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) {
      return Response.json({ error: "User has no organization membership" }, { status: 400 });
    }
    targetOrgId = membership.organization_id;
  }

  if (!targetOrgId) {
    return Response.json({ error: "Organization ID could not be determined" }, { status: 400 });
  }

  try {
    const result = await updateMembershipRole(targetOrgId, userId, orgRole);
    // Update Supabase too
    await getSupabase()
      .from("organization_members")
      .update({ org_role: orgRole === "org:admin" ? "admin" : "member" })
      .eq("user_id", userId)
      .eq("organization_id", targetOrgId);

    await getSupabase().from("activity_events").insert({
      user_id: adminId,
      organization_id: targetOrgId,
      event_type: "role_changed",
      metadata: { target_user_id: userId, new_role: orgRole },
    });

    return Response.json({ ok: true, role: result.role });
  } catch (error) {
    if (error instanceof ClerkApiError) {
      return Response.json({ error: error.message }, { status: 502 });
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
