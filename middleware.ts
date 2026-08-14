import { clerkMiddleware } from "@clerk/nextjs/server";

const PUBLIC_PREFIXES = ["/sign-in", "/sign-up", "/api/webhooks/clerk"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req.nextUrl.pathname)) {
    auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/", "/(api|trpc)(.*)"],
};