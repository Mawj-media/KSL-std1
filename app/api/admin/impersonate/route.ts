import { requireOwnerAdmin } from "../../../../lib/auth";
import { ClerkApiError, createImpersonationToken, findUserByEmail } from "../../../../lib/clerk-admin";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const IMPERSONATION_COOKIE = "ksl_impersonation";
const IMPERSONATION_TTL = 60 * 15; // 15 minutes

export async function POST(req: Request) {
  try {
    await requireOwnerAdmin();
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { userId, email } = (body ?? {}) as { userId?: string; email?: string };

  if (!userId && !email) {
    return Response.json({ error: "userId or email is required" }, { status: 400 });
  }

  let targetId = userId;

  if (!targetId && email) {
    try {
      const user = await findUserByEmail(email.trim());
      if (!user) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }
      targetId = user.id;
    } catch (error) {
      if (error instanceof ClerkApiError) {
        return Response.json({ error: error.message }, { status: 502 });
      }
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  }

  if (!targetId || !/^user_[A-Za-z0-9]+$/.test(targetId)) {
    return Response.json({ error: "Invalid target user id" }, { status: 400 });
  }

  // Prevent impersonating yourself
  const { userId: callerId } = await (await import("@clerk/nextjs/server")).auth();
  if (targetId === callerId) {
    return Response.json({ error: "Cannot impersonate yourself" }, { status: 400 });
  }

  // Prevent impersonating other admins
  const { getSupabase } = await import("../../../../lib/supabase");
  const { data: targetUser } = await getSupabase()
    .from("users")
    .select("role")
    .eq("id", targetId)
    .maybeSingle();
  if (targetUser?.role === "admin") {
    return Response.json({ error: "Cannot impersonate an admin account" }, { status: 403 });
  }

  try {
    const { token } = await createImpersonationToken(targetId, IMPERSONATION_TTL);

    const cookieStore = await cookies();
    cookieStore.set(IMPERSONATION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: IMPERSONATION_TTL,
    });

    return Response.json({ ok: true, userId: targetId, expires_in: IMPERSONATION_TTL });
  } catch (error) {
    if (error instanceof ClerkApiError) {
      return Response.json({ error: error.message }, { status: 502 });
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
