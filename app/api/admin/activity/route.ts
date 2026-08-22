import { requireAdmin } from "../../../../lib/auth";
import { getSupabase } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  const userId = searchParams.get("userId");
  const eventType = searchParams.get("eventType");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
  const offset = (page - 1) * limit;

  try {
    let query = getSupabase()
      .from("activity_events")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (orgId) {
      query = query.eq("organization_id", orgId);
    }
    if (userId) {
      query = query.eq("user_id", userId);
    }
    if (eventType) {
      query = query.eq("event_type", eventType);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      data,
      meta: {
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error) {
    console.error("Activity fetch failed:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
