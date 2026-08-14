import Link from "next/link";
import { findStandard } from "../../../../lib/standards";
import { getSupabase, isSupabaseConfigured } from "../../../../lib/supabase";
import { AdminEditor } from "./AdminEditor";

export const dynamic = "force-dynamic";

export default async function AdminStandardEditPage({ params }: { params: { code: string } }) {
  const std = findStandard(params.code);
  if (!std) {
    return (
      <div className="content">
        <Link href="/admin/standards" className="back-link">← Back to standards</Link>
        <p style={{ marginTop: 20 }}>Unknown standard: {params.code}</p>
      </div>
    );
  }

  let contentHtml = "";
  let contentStatus = "none";
  let available = false;
  if (isSupabaseConfigured()) {
    const { data } = await getSupabase()
      .from("standards")
      .select("content_html, content_status, available")
      .eq("code", params.code)
      .maybeSingle();
    contentHtml = data?.content_html ?? "";
    contentStatus = data?.content_status ?? "none";
    available = data?.available ?? false;
  }

  return (
    <div className="content">
      <Link href="/admin/standards" className="back-link">← Back to standards</Link>
      <div className="admin-editor-head">
        <div>
          <span className="std-code">{std.code}</span>
          <h2 className="admin-editor-title">{std.name}</h2>
        </div>
      </div>
      <AdminEditor
        code={params.code}
        initialHtml={contentHtml}
        initialStatus={contentStatus}
        initialAvailable={available}
      />
    </div>
  );
}