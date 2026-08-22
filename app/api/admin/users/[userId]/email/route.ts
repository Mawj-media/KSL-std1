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

  const { email } = (body ?? {}) as { email?: unknown };

  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return Response.json({ error: "A valid email address is required" }, { status: 400 });
  }

  try {
    // Find user's org before update for activity logging
    const { data: membership } = await getSupabase()
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    await updateUser(userId, { email_address: email.trim() });

    await getSupabase().from("activity_events").insert({
      user_id: ownerId,
      organization_id: membership?.organization_id ?? null,
      event_type: "user_email_updated",
      metadata: { target_user_id: userId, new_email: email.trim() },
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ClerkApiError) {
      return Response.json(
        { error: error.message },
        { status: error.status >= 500 ? 502 : 400 },
      );
    }
    console.error("Email update failed:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
