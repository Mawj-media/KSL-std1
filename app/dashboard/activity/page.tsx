import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { currentOrgContext } from "../../../lib/auth";
import { ActivityLog } from "../../admin/components/ActivityLog";

export const dynamic = "force-dynamic";

export default async function DashboardActivityPage() {
  const { userId } = await auth();
  if (!userId) redirect("/dashboard");

  const orgContext = await currentOrgContext();
  if (!orgContext || orgContext.orgRole !== "admin") redirect("/dashboard");

  return (
    <div className="content">
      <div className="topbar-title">Organization Activity</div>
      <div className="topbar-sub">
        View activity for your organization members including grants, progress, and access changes.
      </div>
      <ActivityLog apiEndpoint="/api/org/activity" viewAs="org-admin" />
    </div>
  );
}
