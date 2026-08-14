export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f0efeb", fontFamily: "-apple-system, Segoe UI, sans-serif", gap: 12 }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: "#0F6E56" }}>Page not found</div>
      <a href="/dashboard" style={{ fontSize: 14, color: "#1D9E75" }}>← Back to dashboard</a>
    </div>
  );
}
