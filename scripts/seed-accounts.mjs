#!/usr/bin/env node
/**
 * Seeds the test organization with learners (mail.tm inboxes) and an org admin.
 * - Creates 4 mail.tm inboxes + Clerk users (org:member) for learners
 * - Creates Clerk user mawjahsan@gmail.com (org:admin)
 * - Mirrors all to Supabase
 * - Removes the two previous seeded users (Aisha Khan, Usman Ali)
 * Credentials are written to scripts/seeded-credentials.json (gitignored).
 * Note: mail.tm new-account auth can lag several minutes; this script polls
 * POST /token until the account authenticates before moving on.
 * Manual mode: node scripts/seed-accounts.mjs --manual <inboxes.json>
 * where inboxes.json is [{ "email": "...", "password": "..." }] (one per learner,
 * in learner order) — skips mail.tm account creation entirely.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

function env(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const envLocal = env(".env.local");
const CLERK_SECRET_KEY = envLocal.CLERK_SECRET_KEY;
const SUPABASE_URL = envLocal.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = envLocal.SUPABASE_SERVICE_ROLE_KEY;

if (!CLERK_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required env vars in .env.local");
  process.exit(1);
}

const ORG_NAME = "Acme Audit Ltd";
let ORG_ID = null;
const MAILTM = "https://api.mail.tm";
const CLERK = "https://api.clerk.com/v1";

const LEARNERS = [
  { first: "Fatima", last: "Noor" },
  { first: "Bilal", last: "Ahmed" },
  { first: "Sara", last: "Malik" },
  { first: "Omar", last: "Faroog" },
];
const ORG_ADMIN = { email: "mawjahsan@gmail.com", name: "Mawj Ahsan" };

const manualArgIndex = process.argv.indexOf("--manual");
const MANUAL_INBOXES_FILE = manualArgIndex >= 0 ? process.argv[manualArgIndex + 1] : null;

// Ahsan Mawji: global app admin (users.role = 'admin'), not an org member.
const REMOVE_ORG_MEMBERSHIPS = [
  { clerkUserId: "user_3HpAqgvEC9hVC4wr9XktgIDuFJ0", email: "ahsanmawj@gmail.com" },
];

const REMOVE_USER_IDS = [
  "user_3Hu5g5116EF2a0lquvdWUt7yY07", // Aisha Khan
  "user_3Hu5g9GQJmx2AvQwrA86OvgcSdg", // Usman Ali
];

async function api(base, path, { method = "GET", headers = {}, body } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 10000 * attempt));
    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (res.ok) return data;
      lastErr = new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
      if (res.status !== 429 && res.status !== 500) throw lastErr;
    } catch (e) {
      if (e instanceof SyntaxError && lastErr) throw lastErr;
      lastErr = e;
    }
  }
  throw lastErr;
}

const clerk = (path, opts) =>
  api(CLERK, path, {
    ...opts,
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}`, ...(opts?.headers ?? {}) },
  });

async function supabase(path, { method = "GET", body } = {}) {
  return api(SUPABASE_URL, path, {
    method,
    body,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal, resolution=merge-duplicates",
    },
  });
}

const rand = () => randomBytes(3).toString("hex");

async function resolveOrgId() {
  let orgs;
  try {
    orgs = await clerk("/organizations?limit=100");
  } catch (e) {
    throw new Error(
      `Clerk Organizations unavailable: ${e.message}. Enable Organizations in Clerk Dashboard (Settings → Organizations), then re-run.`,
    );
  }
  const list = Array.isArray(orgs) ? orgs : (orgs.data ?? []);
  const existing = list.find((o) => o.name === ORG_NAME);
  if (existing) {
    console.log(`  org found: ${ORG_NAME} -> ${existing.id}`);
    return existing.id;
  }
  const created = await clerk("/organizations", {
    method: "POST",
    body: { name: ORG_NAME },
  });
  console.log(`  created org: ${ORG_NAME} -> ${created.id}`);
  return created.id;
}

async function main() {
  console.log("=== Step 0: resolve organization ===\n");
  ORG_ID = await resolveOrgId();

  console.log("\n=== Step 1: remove previous memberships + seeded users ===\n");
  for (const m of REMOVE_ORG_MEMBERSHIPS) {
    await clerk(`/organizations/${ORG_ID}/memberships/${m.clerkUserId}`, {
      method: "DELETE",
    }).catch((e) => console.log(`  clerk membership remove ${m.email}: ${e.message}`));
    await supabase(
      `/rest/v1/organization_members?organization_id=eq.${ORG_ID}&user_id=eq.${m.clerkUserId}`,
      { method: "DELETE" },
    );
    console.log(`  removed org membership: ${m.email}`);
  }
  for (const id of REMOVE_USER_IDS) {
    await clerk(`/users/${id}`, { method: "DELETE" }).catch((e) =>
      console.log(`  clerk delete ${id}: ${e.message}`),
    );
    await supabase(`/rest/v1/activity_events?user_id=eq.${id}`, { method: "DELETE" });
    await supabase(`/rest/v1/users?id=eq.${id}`, { method: "DELETE" });
    console.log(`  removed user ${id}`);
  }

  console.log("\n=== Step 2: clean stale mail.tm users ===\n");
  const existingUsers = await clerk("/users?limit=100");
  const userList = Array.isArray(existingUsers) ? existingUsers : (existingUsers.data ?? []);
  const stale = userList.filter((u) =>
    (u.email_addresses ?? []).some((e) => /@(emalupe\.com|guerrillamail|grr\.la)/.test(e.email_address)),
  );
  for (const u of stale) {
    await clerk(`/users/${u.id}`, { method: "DELETE" });
    await supabase(`/rest/v1/activity_events?user_id=eq.${u.id}`, { method: "DELETE" });
    await supabase(`/rest/v1/users?id=eq.${u.id}`, { method: "DELETE" });
    console.log(`  removed stale ${u.email_addresses?.[0]?.email_address}`);
  }
  if (stale.length === 0) console.log("  none");

  console.log("\n=== Step 3: inboxes ===\n");
  let inboxes;
  if (MANUAL_INBOXES_FILE) {
    const manual = JSON.parse(readFileSync(MANUAL_INBOXES_FILE, "utf8"));
    if (!Array.isArray(manual) || manual.length !== LEARNERS.length) {
      throw new Error(`Manual inboxes file must be an array of exactly ${LEARNERS.length} objects`);
    }
    inboxes = manual.map((m) => ({ address: m.email, password: m.password }));
    inboxes.forEach((c, i) => console.log(`  manual ${i + 1}: ${c.address}`));
  } else {
    const [domain] = await api(MAILTM, "/domains", { headers: { Accept: "application/json" } });
    const domainName = domain.domain;
    const candidates = [];
    for (let i = 0; i < LEARNERS.length; i++) {
      const address = `ksl.learner${i + 1}.${rand()}@${domainName}`;
      const password = `KslLearner2026!${i + 1}${rand()}`;
      await api(MAILTM, "/accounts", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: { address, password },
      }).catch(() => {});
      candidates.push({ address, password });
      console.log(`  created ${i + 1}: ${address} (waiting for auth to settle)`);
    }
    inboxes = [];
    const deadline = Date.now() + 45 * 60 * 1000;
    while (candidates.length > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 30000));
      for (let i = candidates.length - 1; i >= 0; i--) {
        const c = candidates[i];
        try {
          const tok = await api(MAILTM, "/token", {
            method: "POST",
            headers: { Accept: "application/json" },
            body: { address: c.address, password: c.password },
          });
          if (tok.token) {
            inboxes.push(c);
            candidates.splice(i, 1);
            console.log(`  inbox authenticated: ${c.address}`);
          }
        } catch {
          // still settling; keep polling
        }
      }
    }
    if (candidates.length > 0) {
      throw new Error(`mail.tm accounts never authenticated: ${candidates.map((c) => c.address).join(", ")}`);
    }
  }

  console.log("\n=== Step 4: Clerk users ===\n");
  const created = [];
  const adminPassword = `MawjAdmin2026!${rand()}`;
  let orgAdmin = userList.find((u) =>
    (u.email_addresses ?? []).some((e) => e.email_address === ORG_ADMIN.email),
  );
  if (orgAdmin) {
    await clerk(`/users/${orgAdmin.id}`, {
      method: "PATCH",
      body: { password: adminPassword },
    });
    console.log(`  org admin reused: ${ORG_ADMIN.email} -> ${orgAdmin.id}`);
  } else {
    orgAdmin = await clerk("/users", {
      method: "POST",
      body: {
        email_address: [ORG_ADMIN.email],
        password: adminPassword,
        first_name: "Mawj",
        last_name: "Ahsan",
      },
    });
    console.log(`  org admin created: ${ORG_ADMIN.email} -> ${orgAdmin.id}`);
  }
  created.push({ clerkId: orgAdmin.id, email: ORG_ADMIN.email, role: "admin" });

  for (let i = 0; i < LEARNERS.length; i++) {
    const learner = LEARNERS[i];
    const inbox = inboxes[i];
    const clerkPassword = inbox.password;
    const user = await clerk("/users", {
      method: "POST",
      body: {
        email_address: [inbox.address],
        password: clerkPassword,
        first_name: learner.first,
        last_name: learner.last,
      },
    });
    created.push({
      clerkId: user.id,
      email: inbox.address,
      role: "member",
      name: `${learner.first} ${learner.last}`,
      clerkPassword,
      inboxPassword: inbox.password,
    });
    console.log(`  learner ${i + 1}: ${learner.first} ${learner.last} -> ${user.id}`);
  }

  console.log("\n=== Step 5: memberships ===\n");
  const existingMembers = await clerk(`/organizations/${ORG_ID}/memberships?limit=100`);
  const memberIds = new Set(
    (Array.isArray(existingMembers) ? existingMembers : existingMembers.data ?? []).map(
      (m) => m.public_user_data.user_id,
    ),
  );
  for (const c of created) {
    if (memberIds.has(c.clerkId)) {
      console.log(`  ${c.email}: already member (skipped)`);
      continue;
    }
    const mem = await clerk(`/organizations/${ORG_ID}/memberships`, {
      method: "POST",
      body: { user_id: c.clerkId, role: c.role === "admin" ? "org:admin" : "org:member" },
    });
    console.log(`  ${c.email}: ${mem.role}`);
  }

  console.log("\n=== Step 6: Supabase mirror ===\n");
  await supabase("/rest/v1/organizations", {
    method: "POST",
    body: { id: ORG_ID, name: ORG_NAME },
  });
  console.log(`  mirrored org: ${ORG_NAME}`);
  for (const c of created) {
    const name = c.role === "admin" ? ORG_ADMIN.name : c.name;
    await supabase("/rest/v1/users", {
      method: "POST",
      body: { id: c.clerkId, email: c.email, name, role: "client" },
    });
    await supabase("/rest/v1/organization_members", {
      method: "POST",
      body: { organization_id: ORG_ID, user_id: c.clerkId, org_role: c.role === "admin" ? "admin" : "member" },
    });
    console.log(`  mirrored ${c.email} (users + membership)`);
  }

  const credentials = {
    generated_at: new Date().toISOString(),
    org_id: ORG_ID,
    org_admin: { email: ORG_ADMIN.email, password: adminPassword, clerk_id: orgAdmin.id },
    learners: created
      .filter((c) => c.role === "member")
      .map((c) => {
        return { email: c.email, password: c.clerkPassword, inbox_password: c.inboxPassword, clerk_id: c.clerkId };
      }),
  };
  writeFileSync(
    "scripts/seeded-credentials.json",
    JSON.stringify(credentials, null, 2),
  );
  console.log("\n=== DONE ===");
  console.log("Credentials saved to scripts/seeded-credentials.json (gitignored)");
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});