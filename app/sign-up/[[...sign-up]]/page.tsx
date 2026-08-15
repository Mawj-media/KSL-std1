"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SignUp } from "@clerk/nextjs";
import { Brand } from "../../../lib/Brand";

const TOKEN_PARAM = "__clerk_invitation_token";

function hasInvitationToken(): boolean {
  const url = window.location.href;
  const query = url.split("?")[1] ?? "";
  if (new URLSearchParams(query).has(TOKEN_PARAM)) return true;
  return /[?&#]__clerk_invitation_token=([^&]+)/.test(url);
}

export default function Page() {
  const [invited, setInvited] = useState<boolean | null>(null);

  useEffect(() => {
    setInvited(hasInvitationToken());
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0F6E56",
        gap: "24px",
        padding: "20px",
      }}
    >
      <Brand />
      {invited === null ? null : invited ? (
        <SignUp />
      ) : (
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: "16px",
            padding: "32px",
            maxWidth: 400,
            textAlign: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          }}
        >
          <h2 style={{ margin: "0 0 8px", color: "#111827", fontSize: 20 }}>
            Registration is invite-only
          </h2>
          <p style={{ margin: "0 0 20px", color: "#4B5563", fontSize: 14, lineHeight: 1.5 }}>
            If you received an invitation, open the link from your email to create your account.
          </p>
          <Link
            href="/sign-in"
            style={{
              display: "inline-block",
              background: "#0F6E56",
              color: "#FFFFFF",
              borderRadius: "8px",
              padding: "10px 20px",
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Back to sign in
          </Link>
        </div>
      )}
    </div>
  );
}