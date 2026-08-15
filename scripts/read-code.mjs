#!/usr/bin/env node
/**
 * Reads the latest Clerk verification code from a seeded mail.tm inbox.
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

async function readInbox(address, password) {
  const tokenRes = await fetch(`${MAILTM}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ address, password }),
  });
  if (!tokenRes.ok) return { code: null, subject: null, error: `token ${tokenRes.status}` };
  const { token } = await tokenRes.json();
  const listRes = await fetch(`${MAILTM}/messages?page=1`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!listRes.ok) return { code: null, subject: null, error: `messages ${listRes.status}` };
  const list = await listRes.json();
  const latest = (list["hydra:member"] ?? list)[0];
  if (!latest) return { code: null, subject: null, error: null };
  const mailRes = await fetch(`${MAILTM}/messages/${latest.id}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const mail = await mailRes.json();
  const text = `${mail.subject ?? ""} ${mail.text ?? ""} ${mail.html ?? ""}`.replace(/<[^>]+>/g, " ");
  const match = text.match(/\b(\d{6})\b/);
  return { code: match ? match[1] : null, subject: mail.subject ?? null, error: null };
}

async function main() {
  const creds = loadCredentials();
  const target = process.argv[2];
  const learners =
    target === "all" ? creds.learners : creds.learners.filter((l) => l.email === target);
  if (target !== "all" && learners.length === 0) {
    console.error(`No seeded inbox for ${target}. Use "all" or a seeded learner email.`);
    process.exit(1);
  }
  for (const learner of learners) {
    const result = await readInbox(learner.email, learner.inbox_password ?? learner.password);
    console.log(
      `${learner.email}: ${result.code ? `code ${result.code}` : result.error ?? "no code yet"}` +
        (result.subject ? ` (${result.subject})` : ""),
    );
  }
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});