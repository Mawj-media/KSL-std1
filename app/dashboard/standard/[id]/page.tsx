import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { MODULES } from "../../../../content/modules";
import { findStandard } from "../../../../lib/standards";
import { canAccessStandard } from "../../../../lib/auth";
import { getSupabase, isSupabaseConfigured } from "../../../../lib/supabase";
import ModuleFrame from "./ModuleFrame";

export const dynamic = "force-dynamic";

export default async function StandardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const std = findStandard(id);
  const { userId } = await auth();

  let html: string | null = null;
  let available = false;
  let published = false;

  if (isSupabaseConfigured()) {
    const { data } = await getSupabase()
      .from("standards")
      .select("content_html, content_status, available")
      .eq("code", id)
      .maybeSingle();
    html = data?.content_html ?? null;
    available = data?.available ?? false;
    published = data?.content_status === "published";
  } else {
    const b64 = MODULES[id];
    html = b64 ? Buffer.from(b64, "base64").toString("utf-8") : null;
    available = std?.available ?? false;
    published = Boolean(html);
  }

  const openable = available && published;
  const legacyMode = !isSupabaseConfigured();
  const granted = legacyMode || (userId ? await canAccessStandard(userId, id) : false);

  if (!std || !html || !openable || !granted) {
    return (
      <div className="content">
        <Link href="/dashboard" className="back-link">← Back to all standards</Link>
        <p style={{ marginTop: 20 }}>
          {std && !granted
            ? "You do not have access to this module yet."
            : "This module is not available yet."}
        </p>
      </div>
    );
  }

  return <ModuleFrame html={html} standardCode={id} userId={userId ?? null} />;
}