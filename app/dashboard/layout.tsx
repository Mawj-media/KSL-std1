import Link from "next/link";
import { redirect } from "next/navigation";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { Brand } from "../../lib/Brand";
import { currentOrgContext, currentUserRole } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const role = await currentUserRole();
  if (role === "admin") redirect("/admin");

  const orgContext = await currentOrgContext();

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
            <OrganizationSwitcher />
            <UserButton userProfileUrl="/account" userProfileMode="navigation" />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
