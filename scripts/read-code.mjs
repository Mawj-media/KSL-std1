#!/usr/bin/env node
/**
 * Reads the latest Clerk verification code from a mail.tm inbox.
 * Usage: node scripts/read-code.mjs <email>   (or "all" to scan every seeded inbox)
 */
import { readFileSync } from "node:fs";

const MAILTM = "https://api.mail.tm";

function loadCredentials() {
  try {
    return JSON.parse(readFileSync("scripts/seeded-credentials.json", "utf8"));
  } catch {
    console.error("Run scripts/seed-accounts.mjs first (no credentials file).");
    process.exit(1);
  }
}

async function api(path, { method = "GET", headers = {}, body } = {}) {
  const res = await fetch(`${MAILTM}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

async function readInbox(address, password) {
  const { token } = await api("/token", { method: "POST", body: { address, password } });
  const auth = { Authorization: `Bearer ${token}` };
  const messages = await api("/messages", { headers: auth });
  const latest = messages[0];
  if (!latest) return { address, code: null, subject: null };
  const full = await api(`/messages/${latest.id}`, { headers: auth });
  const text = `${full.subject ?? ""} ${full.text ?? ""} ${full.html?.[0] ?? ""}`.replace(/<[^>]+>/g, " ");
  const match = text.match(/\b(\d{6})\b/);
  return { address, code: match ? match[1] : null, subject: full.subject ?? null };
}

async function main() {
  const creds = loadCredentials();
  const target = process.argv[2];
  const inboxes =
    target === "all"
      ? creds.learners
      : creds.learners.filter((l) => l.email === target);
  if (target !== "all" && inboxes.length === 0) {
    console.error(`No seeded inbox for ${target}. Use "all" or a seeded learner email.`);
    process.exit(1);
  }
  for (const inbox of inboxes) {
    const result = await readInbox(inbox.email, inbox.password);
    console.log(
      `${result.address}: ${result.code ? `code ${result.code}` : "no code yet"}` +
        (result.subject ? ` (${result.subject})` : ""),
    );
  }
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});