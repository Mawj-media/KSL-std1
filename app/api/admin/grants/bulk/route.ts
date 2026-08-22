import { requireAdmin } from "../../../../../lib/auth";
import { getSupabase } from "../../../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { orgId, standardCode, action } = body;

  if (
    typeof orgId !== "string" ||
    typeof standardCode !== "string" ||
    !["grant", "revoke"].includes(action)
  ) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const { data: members, error: fetchError } = await getSupabase()
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId);

    if (fetchError) {
      return Response.json({ error: fetchError.message }, { status: 500 });
    }

    if (!members || members.length === 0) {
      return Response.json({ error: "No members in this organization" }, { status: 400 });
    }

    const userIds = members.map((m) => m.user_id);

    if (action === "grant") {
      const grants = userIds.map((userId) => ({
        user_id: userId,
        standard_code: standardCode,
        granted_by: adminId,
      }));

      const { error } = await getSupabase()
        .from("access_grants")
        .upsert(grants, { onConflict: "user_id,standard_code" });

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await getSupabase()
        .from("access_grants")
        .delete()
        .in("user_id", userIds)
        .eq("standard_code", standardCode);

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    await getSupabase().from("activity_events").insert({
      user_id: adminId,
      organization_id: orgId,
      event_type: action === "grant" ? "bulk_standard_granted" : "bulk_standard_revoked",
      standard_code: standardCode,
      metadata: { affected_users: userIds.length },
    });

    return Response.json({ ok: true, affected: userIds.length });
  } catch (error) {
    console.error("Bulk grant update failed:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
