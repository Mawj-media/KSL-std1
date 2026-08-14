const BAPI = "https://api.clerk.com/v1";

type ClerkUserResponse = {
  id: string;
  email_addresses?: { id: string; email_address: string; primary?: boolean }[];
};

function getSecretKey(): string {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) throw new Error("CLERK_SECRET_KEY not configured");
  return key;
}

async function bapi(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${BAPI}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`Clerk BAPI ${path}: HTTP ${res.status}`);
  return res.json();
}

export async function fetchClerkUser(userId: string): Promise<ClerkUserResponse | null> {
  try {
    return (await bapi(`/users/${userId}`)) as ClerkUserResponse;
  } catch (error) {
    console.error("fetchClerkUser failed:", error);
    return null;
  }
}

export async function deleteClerkEmail(emailId: string): Promise<boolean> {
  try {
    await bapi(`/email_addresses/${emailId}`, { method: "DELETE" });
    return true;
  } catch (error) {
    console.error("deleteClerkEmail failed:", error);
    return false;
  }
}

export function primaryEmailOf(user: ClerkUserResponse | null): string | null {
  if (!user?.email_addresses?.length) return null;
  const primary = user.email_addresses.find((e) => e.primary);
  return primary?.email_address ?? user.email_addresses[0].email_address;
}