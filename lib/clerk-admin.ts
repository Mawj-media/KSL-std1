const BAPI = "https://api.clerk.com/v1";

export class ClerkApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

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

export async function createOrganization(name: string): Promise<{ id: string; name: string }> {
  return bapi("/organizations", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function createOrganizationInvitation(
  orgId: string,
  email: string,
  role: "org:admin" | "org:member",
  redirectUrl: string,
): Promise<{ id: string }> {
  return bapi(`/organizations/${orgId}/invitations`, {
    method: "POST",
    body: JSON.stringify({ email_address: email, role, redirect_url: redirectUrl }),
  });
}
export async function deleteUser(userId: string): Promise<{ id: string; deleted: boolean }> {
  return bapi(`/users/${userId}`, { method: "DELETE" });
}

export async function findUserByEmail(email: string): Promise<{ id: string; email_addresses: { email_address: string }[] } | null> {
  const res = await bapi<{ data: Array<{ id: string; email_addresses: { email_address: string }[] }> }>(
    `/users?email_address=${encodeURIComponent(email)}&limit=1`,
  );
  return res.data?.[0] ?? null;
}

export async function listUserOrganizationMemberships(userId: string): Promise<Array<{
  id: string;
  organization_id: string;
  role: "org:admin" | "org:member";
  created_at: string;
}>> {
  const res = await bapi<{ data: Array<{
    id: string;
    organization_id: string;
    role: "org:admin" | "org:member";
    created_at: string;
  }> }>(
    `/users/${userId}/organization_memberships`,
  );
  return res.data ?? [];
}

export async function deleteOrganizationMembership(orgId: string, userId: string): Promise<{ id: string; deleted: boolean }> {
  return bapi(`/organizations/${orgId}/memberships/${userId}`, { method: "DELETE" });
}
