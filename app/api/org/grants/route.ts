import { auth } from "@clerk/nextjs/server";
import { requireOrgAdmin } from "../../../../lib/auth";
import { getSupabase } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let orgId: string;
  try {
    orgId = await requireOrgAdmin();
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId: adminId } = await auth();
  if (!adminId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { userId, standardCode, action } = body;

  if (
    typeof userId !== "string" ||
    typeof standardCode !== "string" ||
    !["grant", "revoke"].includes(action)
  ) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
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

    if (action === "grant") {
      const { error } = await getSupabase()
        .from("access_grants")
        .upsert(
          { user_id: userId, standard_code: standardCode, granted_by: adminId },
          { onConflict: "user_id,standard_code" }
        );
      if (error) return Response.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await getSupabase()
        .from("access_grants")
        .delete()
        .eq("user_id", userId)
        .eq("standard_code", standardCode);
      if (error) return Response.json({ error: error.message }, { status: 500 });
    }

    await getSupabase().from("activity_events").insert({
      user_id: adminId,
      organization_id: orgId,
      event_type: action === "grant" ? "standard_granted" : "standard_revoked",
      standard_code: standardCode,
      metadata: { target_user_id: userId },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Org grant update failed:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
