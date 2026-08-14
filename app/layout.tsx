import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "KSL – GRC Consultancy | IIA Standards Compliance",
  description: "IIA Global Internal Audit Standards Compliance Training Program",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
