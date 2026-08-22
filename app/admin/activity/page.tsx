import { requireAdmin } from "../../../lib/auth";
import { ActivityLog } from "../components/ActivityLog";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
  try {
    await requireAdmin();
  } catch {
    return (
      <div className="content">
        <div className="topbar-title">Activity Log</div>
        <p style={{ marginTop: 20 }}>Access denied. Admin only.</p>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="topbar-title">Activity Log</div>
      <div className="topbar-sub">
        View all platform activity including grants, revokes, user management, and standard updates.
      </div>
      <ActivityLog apiEndpoint="/api/admin/activity" viewAs="platform-admin" />
    </div>
  );
}
