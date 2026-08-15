import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

const PUBLIC_PREFIXES = ["/sign-in", "/sign-up", "/api/webhooks/clerk"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req.nextUrl.pathname)) return;

  const { userId } = await auth();
  if (!userId) {
    const ticket = req.nextUrl.searchParams.get("__clerk_ticket");
    if (ticket) {
      const status = req.nextUrl.searchParams.get("__clerk_status");
      const dest = new URL(status === "sign_up" ? "/sign-up" : "/sign-in", req.url);
      dest.searchParams.set("__clerk_ticket", ticket);
      if (status) dest.searchParams.set("__clerk_status", status);
      dest.searchParams.set("redirect_url", req.nextUrl.pathname);
      return NextResponse.redirect(dest);
    }
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set(
      "redirect_url",
      req.nextUrl.pathname + req.nextUrl.search,
    );
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/", "/(api|trpc)(.*)"],
};