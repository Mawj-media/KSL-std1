import { requireAdmin } from "../../../../lib/auth";
import { getSupabase } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
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
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Grant update failed:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}