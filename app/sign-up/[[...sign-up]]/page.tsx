import { SignUp } from "@clerk/nextjs";
import { Brand } from "../../../lib/Brand";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0F6E56", gap: "24px", padding: "20px" }}>
      <Brand />
      <SignUp />
    </div>
  );
}
