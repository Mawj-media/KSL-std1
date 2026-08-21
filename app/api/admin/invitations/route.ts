import { requireAdmin } from "../../../../lib/auth";
import { ClerkApiError, createOrganizationInvitation, findUserByEmail, listUserOrganizationMemberships } from "../../../../lib/clerk-admin";
import { getSupabase } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const { email, orgId, orgRole } = (body ?? {}) as {
    email?: unknown;
    orgId?: unknown;
    orgRole?: unknown;
  };

  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return Response.json({ error: "A valid email address is required" }, { status: 400 });
  }
  if (typeof orgId !== "string" || orgId.length === 0) {
    return Response.json({ error: "Organization is required" }, { status: 400 });
  }
  if (orgRole !== "org:admin" && orgRole !== "org:member") {
    return Response.json({ error: "Role must be org:admin or org:member" }, { status: 400 });
  }

  // Single-org policy: check if user already belongs to an organization
  const existingUser = await findUserByEmail(email.trim());
  if (existingUser) {
    const memberships = await listUserOrganizationMemberships(existingUser.id);
    if (memberships.length > 0) {
      // Fetch org name for the error message
      const { data: orgData } = await getSupabase()
        .from("organizations")
        .select("name")
        .eq("id", memberships[0].organization_id)
        .maybeSingle();
      const orgName = orgData?.name ?? memberships[0].organization_id;
      return Response.json(
        { error: `This user already belongs to ${orgName} — each user can only join one organization.` },
        { status: 400 },
      );
    }
  }

  const redirectUrl = new URL("/dashboard", req.url).toString();

  try {
    const invitation = await createOrganizationInvitation(orgId, email.trim(), orgRole, redirectUrl);
    return Response.json({ ok: true, invitation });
  } catch (error) {
    if (error instanceof ClerkApiError) {
      return Response.json(
        { error: error.message },
        { status: error.status >= 500 ? 502 : 400 },
      );
    }
    console.error("Invitation create failed:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}