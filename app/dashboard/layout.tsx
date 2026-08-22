import Link from "next/link";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Brand } from "../../lib/Brand";
import { currentOrgContext, currentUserRole } from "../../lib/auth";
import { getSupabase } from "../../lib/supabase";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const role = await currentUserRole();
  if (role === "admin") redirect("/admin");

  const orgContext = await currentOrgContext();

  let orgName = "No Organization";
  if (orgContext?.orgId) {
    const { data } = await getSupabase()
      .from("organizations")
      .select("name")
      .eq("id", orgContext.orgId)
      .maybeSingle();
    if (data?.name) orgName = data.name;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-head">
          <Brand />
          <div className="sidebar-tag">Internal Audit</div>
          <div className="sidebar-title">IIA Standards Compliance</div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-label">Program</div>
          <Link href="/dashboard" className="nav-item"><span className="nav-dot" /> All Standards</Link>
          <Link href="/dashboard/tracker" className="nav-item"><span className="nav-dot" /> Compliance Tracker</Link>
          {orgContext?.orgRole === "admin" && (
            <Link href="/dashboard/org-tracker" className="nav-item"><span className="nav-dot" /> Team Compliance Tracker</Link>
          )}
          {orgContext?.orgRole === "admin" && (
            <Link href="/dashboard/activity" className="nav-item"><span className="nav-dot" /> Activity Log</Link>
          )}
        </nav>
        <div className="sidebar-foot">
          © 2025 KSL - GRC Consultancy<br />
          Licensed access. Resale prohibited.
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <div className="topbar-title">Compliance Program</div>
            <div className="topbar-sub">IIA Global Internal Audit Standards 2024</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "#0F6E56",
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {orgName}
            </span>
            <UserButton userProfileUrl="/account" userProfileMode="navigation" />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
