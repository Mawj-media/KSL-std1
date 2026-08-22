"use client";

type Variant = "admin" | "member" | "completed" | "in-progress" | "not-started" | "pending" | "expired" | "na";

const CLASS: Record<Variant, string> = {
  admin: "admin-pill admin-pill-org-admin",
  member: "admin-pill admin-pill-member",
  completed: "admin-pill admin-pill-published",
  "in-progress": "admin-pill admin-pill-pending",
  "not-started": "admin-pill admin-pill-draft",
  pending: "admin-pill admin-pill-pending",
  expired: "admin-pill admin-pill-expired",
  na: "admin-pill admin-pill-none",
};

export function Badge({
  variant,
  children,
}: {
  variant: Variant;
  children: React.ReactNode;
}) {
  return <span className={CLASS[variant]}>{children}</span>;
}
