import { SignIn } from "@clerk/nextjs";
import { Brand } from "../../../lib/Brand";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0F6E56", gap: "24px", padding: "20px" }}>
      <Brand />
      <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, textAlign: "center", maxWidth: 360 }}>
        IIA Global Internal Audit Standards — Compliance Training Program
      </div>
      <SignIn />
    </div>
  );
}
