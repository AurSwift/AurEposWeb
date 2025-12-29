import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(req: NextRequest) {
  const { nextUrl } = req;

  // Skip middleware for API routes, static files, and Next.js internals
  if (
    nextUrl.pathname.startsWith("/api") ||
    nextUrl.pathname.startsWith("/_next") ||
    nextUrl.pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isLoggedIn = !!token;

  // Log route changes (always log for debugging)
  const timestamp = new Date().toISOString();
  console.log(
    `[${timestamp}] ${req.method} ${nextUrl.pathname}${
      nextUrl.search ? `?${nextUrl.search}` : ""
    } - Logged in: ${isLoggedIn}`
  );

  const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
  const isOnLoginPage = nextUrl.pathname.startsWith("/login");

  // Protect dashboard routes - redirect to login if not authenticated
  if (isOnDashboard && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Only redirect from login page to dashboard if already logged in
  // Allow signup and other auth pages to be accessible
  if (isOnLoginPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
