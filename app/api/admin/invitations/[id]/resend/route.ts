import { requireAdmin } from "../../../../../../lib/auth";
import { ClerkApiError, resendOrganizationInvitation } from "../../../../../../lib/clerk-admin";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: invitationId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { orgId } = (body ?? {}) as { orgId?: string };

  if (!orgId) {
    return Response.json({ error: "orgId is required" }, { status: 400 });
  }

  try {
    const result = await resendOrganizationInvitation(orgId, invitationId);
    return Response.json({ ok: true, invitation: result });
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
