// Seeds standard content from content/modules.ts into Supabase.
// Usage: node --env-file=.env.local scripts/seed-standards.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { ensureModuleContract } from "../lib/moduleContract.ts";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (use --env-file=.env.local)");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const src = readFileSync(new URL("../content/modules.ts", import.meta.url), "utf8");

const entries = [...src.matchAll(/^\s*"([a-z0-9-]+)":\s*"([A-Za-z0-9+/=]+)"/gm)]
  .map(([, slug, b64]) => ({ slug, html: Buffer.from(b64, "base64").toString("utf-8") }))
  .filter((e) => e.html.length > 0);

if (entries.length === 0) {
  console.log("No modules found in content/modules.ts");
  process.exit(0);
}

const skipped = [];

for (const { slug, html } of entries) {
  const normalized = ensureModuleContract(html);
  if (!normalized.conformant) {
    console.warn(`SKIP ${slug}: content does not match the platform contract (see content/module-template.html)`);
    skipped.push(slug);
    continue;
  }
  const { error } = await supabase.from("standards").upsert({
    code: slug,
    content_html: normalized.html,
    content_status: "published",
    available: true,
    updated_at: new Date().toISOString(),
    updated_by: "seed",
  });
  if (error) {
    console.error(`Failed to seed ${slug}:`, error.message);
    process.exit(1);
  }
  console.log(`Seeded ${slug} (${(normalized.html.length / 1024).toFixed(1)} KB)`);
}

if (skipped.length > 0) {
  console.log(`Skipped ${skipped.length} non-conformant: ${skipped.join(", ")}`);
}
console.log("Done.");
