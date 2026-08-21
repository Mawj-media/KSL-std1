import { Webhook } from "svix";
import { headers } from "next/headers";
import { getSupabase } from "../../../../lib/supabase";
import { deleteClerkEmail, fetchClerkUser, primaryEmailOf } from "../../../../lib/clerk-sync";
import { listUserOrganizationMemberships, deleteOrganizationMembership } from "../../../../lib/clerk-admin";

export const dynamic = "force-dynamic";

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

type ClerkUserEvent =
  | { type: "user.created" | "user.updated"; data: ClerkUser }
  | { type: "user.deleted"; data: { id: string } };

type ClerkUser = {
  id: string;
  email_addresses?: { email_address?: string }[];
  first_name?: string | null;
  last_name?: string | null;
  public_metadata?: { role?: string };
};

type ClerkOrgEvent =
  | { type: "organization.created" | "organization.updated"; data: ClerkOrganization }
  | { type: "organization.deleted"; data: { id: string } };

type ClerkOrganization = {
  id: string;
  name?: string | null;
  slug?: string | null;
};

type ClerkMembershipEvent =
  | { type: "organizationMembership.created" | "organizationMembership.updated"; data: ClerkMembership }
  | { type: "organizationMembership.deleted"; data: ClerkMembership };

type ClerkMembership = {
  organization?: ClerkOrganization;
  public_user_data?: { user_id?: string };
  role?: "org:admin" | "org:member";
};

type ClerkEmailEvent = {
  type: "emailAddress.created" | "emailAddress.updated" | "emailAddress.deleted";
  data: {
    id: string;
    email_address?: string;
    user_id?: string;
  };
};

const MAX_EMAILS_PER_USER = 1;

async function enforceSingleOrgPolicy(membership: ClerkMembership) {
  const userId = membership.public_user_data?.user_id;
  const orgId = membership.organization?.id;
  if (!userId || !orgId) return;

  // Check if user is admin (exempt from single-org policy)
  const { data: userRow } = await getSupabase()
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (userRow?.role === "admin") return;

  const memberships = await listUserOrganizationMemberships(userId);
  if (memberships.length <= 1) return;

  // Find the newest membership by created_at
  const sorted = [...memberships].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const newest = sorted[0];

  // Delete the newest membership (should be the one that just triggered this webhook)
  try {
    await deleteOrganizationMembership(newest.organization_id, userId);
    await getSupabase().from("activity_events").insert({
      user_id: userId,
      event_type: "membership_removed",
      metadata: {
        removed_org_id: newest.organization_id,
        kept_org_id: sorted[1]?.organization_id ?? null,
        reason: "single_org_policy",
      },
    });
  } catch (err) {
    console.error("Single-org enforcement failed:", err);
  }
}

async function syncUserEmail(userId: string) {
  const user = await fetchClerkUser(userId);
  const email = primaryEmailOf(user);
  await getSupabase().from("users").update({ email, updated_at: new Date().toISOString() }).eq("id", userId);
}

async function enforceMaxEmails(data: ClerkEmailEvent["data"]) {
  const userId = data.user_id;
  if (!userId) return;

  const user = await fetchClerkUser(userId);
  if (!user) return;
  if ((user.email_addresses?.length ?? 0) <= MAX_EMAILS_PER_USER) return;

  const rejected = data.id;
  const email = data.email_address ?? null;
  const deleted = await deleteClerkEmail(rejected);

  await getSupabase().from("activity_events").insert({
    user_id: userId,
    event_type: "email_add_rejected",
    metadata: {
      email,
      email_id: rejected,
      reason: "max_one_email",
      deleted,
    },
  });
}

function toUser(data: ClerkUser) {
  const email = data.email_addresses?.[0]?.email_address ?? null;
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;
  const role = data.public_metadata?.role === "admin" ? "admin" : "client";
  return { email, name, role };
}

async function syncMembership(data: ClerkMembership) {
  const org = data.organization;
  const userId = data.public_user_data?.user_id;
  if (!org?.id || !userId) return;

  await getSupabase().from("organizations").upsert({
    id: org.id,
    name: org.name || org.slug || "Organization",
    updated_at: new Date().toISOString(),
  });

  await getSupabase()
    .from("users")
    .upsert({ id: userId, updated_at: new Date().toISOString() });

  await getSupabase()
    .from("organization_members")
    .upsert({
      organization_id: org.id,
      user_id: userId,
      org_role: data.role === "org:admin" ? "admin" : "member",
      joined_at: new Date().toISOString(),
    });
}

export async function POST(req: Request) {
  if (!webhookSecret) {
    return new Response("CLERK_WEBHOOK_SECRET not configured", { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const rawBody = await req.text();

  let payload: { type: string; data: unknown };
  try {
    payload = new Webhook(webhookSecret).verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as { type: string; data: unknown };
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  const { type, data } = payload;

  switch (type) {
    case "user.created":
    case "user.updated": {
      const user = toUser(data as ClerkUser);
      await getSupabase().from("users").upsert({
        id: (data as ClerkUser).id,
        email: user.email,
        name: user.name,
        role: user.role,
        updated_at: new Date().toISOString(),
      });
      break;
    }
    case "user.deleted": {
      await getSupabase().from("users").delete().eq("id", (data as { id: string }).id);
      break;
    }
    case "organization.created":
    case "organization.updated": {
      const org = data as ClerkOrganization;
      await getSupabase().from("organizations").upsert({
        id: org.id,
        name: org.name || org.slug || "Organization",
        updated_at: new Date().toISOString(),
      });
      break;
    }
    case "organization.deleted": {
      await getSupabase().from("organizations").delete().eq("id", (data as { id: string }).id);
      break;
    }
    case "organizationMembership.created": {
      const m = data as ClerkMembership;
      await syncMembership(m);
      await enforceSingleOrgPolicy(m);
      break;
    }
    case "organizationMembership.updated": {
      await syncMembership(data as ClerkMembership);
      break;
    }
    case "organizationMembership.deleted": {
      const m = data as ClerkMembership;
      const orgId = m.organization?.id;
      const userId = m.public_user_data?.user_id;
      if (orgId && userId) {
        await getSupabase()
          .from("organization_members")
          .delete()
          .eq("organization_id", orgId)
          .eq("user_id", userId);
      }
      break;
    }
    case "emailAddress.created": {
      await enforceMaxEmails((data as ClerkEmailEvent["data"]));
      break;
    }
    case "emailAddress.updated":
    case "emailAddress.deleted": {
      const userId = (data as ClerkEmailEvent["data"]).user_id;
      if (userId) await syncUserEmail(userId);
      break;
    }
  }

  return new Response("OK", { status: 200 });
}