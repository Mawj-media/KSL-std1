import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const IMPERSONATION_COOKIE = "ksl_impersonation";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);
  return Response.json({ ok: true });
}
