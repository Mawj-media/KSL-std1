import { requireAdmin } from "../../../../../lib/auth";
import { ClerkApiError } from "../../../../../lib/clerk-admin";

const BAPI = "https://api.clerk.com/v1";

function getSecretKey(): string {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) throw new Error("CLERK_SECRET_KEY not configured");
  return key;
}

async function bapi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BAPI}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const message =
      (data as { errors?: { message?: string }[] } | null)?.errors?.[0]?.message ?? `HTTP ${res.status}`;
    throw new ClerkApiError(res.status, message);
  }
  return data as T;
}

export const dynamic = "force-dynamic";

export async function DELETE(
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
    await bapi(`/organizations/${orgId}/invitations/${invitationId}/revoke`, {
      method: "POST",
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ClerkApiError) {
      return Response.json(
        { error: error.message },
        { status: error.status === 404 ? 404 : error.status >= 500 ? 502 : 400 },
      );
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
