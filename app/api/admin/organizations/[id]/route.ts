import { requireAdmin } from "../../../../../lib/auth";
import { ClerkApiError, updateOrganization, deleteOrganization } from "../../../../../lib/clerk-admin";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { name } = (body ?? {}) as { name?: unknown };

  if (typeof name !== "string" || name.trim().length === 0) {
    return Response.json({ error: "Organization name is required" }, { status: 400 });
  }

  try {
    const org = await updateOrganization(id, { name: name.trim() });
    return Response.json({ ok: true, organization: org });
  } catch (error) {
    if (error instanceof ClerkApiError) {
      return Response.json(
        { error: error.message },
        { status: error.status >= 500 ? 502 : 400 },
      );
    }
    console.error("Organization update failed:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await deleteOrganization(id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ClerkApiError) {
      return Response.json(
        { error: error.message },
        { status: error.status >= 500 ? 502 : 400 },
      );
    }
    console.error("Organization delete failed:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
