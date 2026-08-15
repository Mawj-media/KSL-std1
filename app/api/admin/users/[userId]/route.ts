import { requireOwnerAdmin } from "../../../../../lib/auth";
import { deleteUser, ClerkApiError } from "../../../../../lib/clerk-admin";
import { getSupabase } from "../../../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  let ownerId: string;
  try {
    ownerId = await requireOwnerAdmin();
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  if (!/^user_[A-Za-z0-9]+$/.test(userId)) {
    return Response.json({ error: "Invalid user id" }, { status: 400 });
  }
  if (userId === ownerId) {
    return Response.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  try {
    const { data } = await getSupabase()
      .from("users")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (data?.role === "admin") {
      return Response.json({ error: "Cannot delete an admin account" }, { status: 403 });
    }
  } catch {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }

  try {
    const result = await deleteUser(userId);
    return Response.json({ ok: true, deleted: result.deleted });
  } catch (error) {
    if (error instanceof ClerkApiError) {
      return Response.json({ error: error.message }, { status: error.status === 404 ? 404 : 502 });
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
