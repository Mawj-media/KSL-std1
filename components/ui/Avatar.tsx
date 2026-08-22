"use client";

function initials(name: string | null, email: string | null): string {
  if (name) {
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

export function Avatar({
  name,
  email,
  size = 36,
}: {
  name: string | null;
  email: string | null;
  size?: number;
}) {
  return (
    <div
      className="admin-user-avatar"
      style={{ width: size, height: size, fontSize: size < 40 ? 11 : 14 }}
    >
      {initials(name, email)}
    </div>
  );
}
