import Link from "next/link";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Brand } from "../../lib/Brand";
import { currentUserRole } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const role = await currentUserRole();
  if (role !== "admin") redirect("/dashboard");

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-head">
          <Brand />
          <div className="sidebar-tag">Admin Console</div>
          <div className="sidebar-title">Content & Access</div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-label">Manage</div>
          <Link href="/admin/standards" className="nav-item">
            <span className="nav-dot" /> Standards
          </Link>
          <Link href="/admin/users" className="nav-item">
            <span className="nav-dot" /> Users & Access
          </Link>
          <div className="nav-label">Program</div>
          <Link href="/dashboard" className="nav-item">
            <span className="nav-dot" /> View client portal
          </Link>
        </nav>
        <div className="sidebar-foot">
          © 2025 KSL - GRC Consultancy<br />
          Licensed access. Resale prohibited.
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <div className="topbar-title">Admin Console</div>
            <div className="topbar-sub">Standards content, users and access</div>
          </div>
          <UserButton userProfileUrl="/account" userProfileMode="navigation" />
        </header>
        {children}
      </div>
    </div>
  );
}