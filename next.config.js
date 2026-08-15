/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

// Module HTML is injected via iframe srcDoc, which inherits the parent's CSP.
// The modules rely on inline <style>/<script> blocks, so inline sources must
// stay allowed for scripts/styles; the iframe sandbox (allow-scripts only,
// no allow-same-origin) is the primary isolation boundary for that content.
// Clerk is served from the custom auth domain clerk.kslconsultancy.ca.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://clerk.kslconsultancy.ca",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://clerk.kslconsultancy.ca wss://clerk.kslconsultancy.ca",
  "frame-src 'self' https://clerk.kslconsultancy.ca",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

const nextConfig = {
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        ...securityHeaders,
        ...(isProd
          ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }]
          : []),
      ],
    },
  ],
};

module.exports = nextConfig;
