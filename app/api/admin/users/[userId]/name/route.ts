import { requireOwnerAdmin } from "../../../../../../lib/auth";
import { ClerkApiError, updateUser } from "../../../../../../lib/clerk-admin";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireOwnerAdmin();
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
    await updateUser(userId, { first_name: firstName.trim(), last_name: lastName.trim() });
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
