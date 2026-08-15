import { requireAdmin } from "../../../../lib/auth";
import { ClerkApiError, createOrganization } from "../../../../lib/clerk-admin";

export const dynamic = "force-dynamic";

const ORG_NAME_MAX = 200;

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const name = (body as { name?: unknown }).name;
  if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > ORG_NAME_MAX) {
    return Response.json({ error: "Organization name is required (max 200 characters)" }, { status: 400 });
  }

  try {
    const organization = await createOrganization(name.trim());
    return Response.json({ ok: true, organization });
  } catch (error) {
    if (error instanceof ClerkApiError) {
      return Response.json(
        { error: error.message },
        { status: error.status >= 500 ? 502 : 400 },
      );
    }
    console.error("Organization create failed:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}