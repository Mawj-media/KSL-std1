import { requireOwnerAdmin } from "../../../../../../lib/auth";
import { ClerkApiError, updateUser } from "../../../../../../lib/clerk-admin";
import { getSupabase } from "../../../../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  let ownerId: string;
  try {
    ownerId = await requireOwnerAdmin();
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { firstName, lastName } = (body ?? {}) as { firstName?: unknown; lastName?: unknown };

  if (typeof firstName !== "string" || typeof lastName !== "string") {
    return Response.json({ error: "firstName and lastName are required" }, { status: 400 });
  }

  try {
    // Find user's org before update for activity logging
    const { data: membership } = await getSupabase()
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    await updateUser(userId, { first_name: firstName.trim(), last_name: lastName.trim() });

    await getSupabase().from("activity_events").insert({
      user_id: ownerId,
      organization_id: membership?.organization_id ?? null,
      event_type: "user_name_updated",
      metadata: { target_user_id: userId, new_name: `${firstName.trim()} ${lastName.trim()}`.trim() },
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ClerkApiError) {
      return Response.json(
        { error: error.message },
        { status: error.status >= 500 ? 502 : 400 },
      );
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
