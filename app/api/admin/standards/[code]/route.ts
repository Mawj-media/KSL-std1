import { requireAdmin } from "../../../../../lib/auth";
import { ensureModuleContract } from "../../../../../lib/moduleContract";
import { getSupabase } from "../../../../../lib/supabase";

export const dynamic = "force-dynamic";

const MAX_HTML_BYTES = 2 * 1024 * 1024;

const CONTRACT_ERROR =
  "Module content does not match the platform contract (self-assessment items + scenarios with the standard state API). " +
  "Copy content/module-template.html, replace the checklist items, scenarios, and texts, then publish. " +
  "Publishing was blocked to prevent a module users cannot complete.";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { code } = await params;
  const body = await req.json();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: adminId,
  };

  if (body.content_html !== undefined) {
    if (typeof body.content_html !== "string") {
      return Response.json({ error: "content_html must be a string" }, { status: 400 });
    }
    if (body.content_html.length > MAX_HTML_BYTES) {
      return Response.json({ error: "Content too large (max 2MB)" }, { status: 400 });
    }
    const normalized = ensureModuleContract(body.content_html);
    if (!normalized.conformant) {
      return Response.json({ error: CONTRACT_ERROR }, { status: 400 });
    }
    patch.content_html = normalized.html;
  }

  if (body.content_status !== undefined) {
    if (!["draft", "published"].includes(body.content_status)) {
      return Response.json({ error: "Invalid content_status" }, { status: 400 });
    }
    patch.content_status = body.content_status;
  }

  if (body.available !== undefined) {
    if (typeof body.available !== "boolean") {
      return Response.json({ error: "available must be a boolean" }, { status: 400 });
    }
    patch.available = body.available;
  }

  try {
    if (patch.content_status === "published") {
      let contentToPublish =
        typeof patch.content_html === "string" ? patch.content_html : undefined;

      if (contentToPublish === undefined) {
        const existing = await getSupabase()
          .from("standards")
          .select("content_html")
          .eq("code", code)
          .maybeSingle();
        if (!existing.data?.content_html?.trim()) {
          return Response.json({ error: "Cannot publish a standard without content" }, { status: 400 });
        }
        const normalized = ensureModuleContract(existing.data.content_html);
        if (!normalized.conformant) {
          return Response.json({ error: CONTRACT_ERROR }, { status: 400 });
        }
        if (normalized.html !== existing.data.content_html) {
          patch.content_html = normalized.html;
        }
      }
    }

    const { error } = await getSupabase()
      .from("standards")
      .upsert({ code, ...patch }, { onConflict: "code" });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Admin standards update failed:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}