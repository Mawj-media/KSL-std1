import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "./supabase";

export type Role = "admin" | "client";

async function roleFromClaims(): Promise<Role | null> {
  const { sessionClaims } = await auth();
  const claims = sessionClaims as Record<string, unknown> | null;
  const pub = (claims?.public_metadata ?? claims?.metadata) as { role?: string } | undefined;
  return pub?.role === "admin" ? "admin" : null;
}

export async function currentUserRole(): Promise<Role | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const fromClaims = await roleFromClaims();
  if (fromClaims) return fromClaims;
  try {
    const { data } = await getSupabase()
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();
    return data?.role ?? null;
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const role = await currentUserRole();
  if (role !== "admin") throw new Error("forbidden");
  return userId;
}

export type OrgContext = { orgId: string; orgRole: "admin" | "member" };

export async function currentOrgContext(): Promise<OrgContext | null> {
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId) return null;

  if (orgRole === "admin" || orgRole === "member") {
    return { orgId, orgRole };
  }

  try {
    const { data } = await getSupabase()
      .from("organization_members")
      .select("org_role")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!data) return null;
    return { orgId, orgRole: data.org_role === "admin" ? "admin" : "member" };
  } catch {
    return null;
  }
}

export async function requireOrgAdmin(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const ctx = await currentOrgContext();
  if (!ctx || ctx.orgRole !== "admin") throw new Error("forbidden");
  return ctx.orgId;
}

export async function canAccessStandard(userId: string | null, code: string): Promise<boolean> {
  if (!userId) return false;
  const role = await currentUserRole();
  if (role === "admin") return true;
  const orgContext = await currentOrgContext();
  if (orgContext) return true;
  try {
    const { data } = await getSupabase()
      .from("access_grants")
      .select("standard_code")
      .eq("user_id", userId)
      .eq("standard_code", code)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}