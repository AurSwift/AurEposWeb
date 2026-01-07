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
  const userRole = token?.role as string | undefined;

  // Log route changes (always log for debugging)
  const timestamp = new Date().toISOString();
  console.log(
    `[${timestamp}] ${req.method} ${nextUrl.pathname}${
      nextUrl.search ? `?${nextUrl.search}` : ""
    } - Logged in: ${isLoggedIn}, Role: ${userRole || "none"}`
  );

  const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
  const isOnAdmin = nextUrl.pathname.startsWith("/admin");
  const isOnLoginPage = nextUrl.pathname.startsWith("/login");
  
  const isInternalUser = userRole === "admin" || userRole === "support" || userRole === "developer";
  const isCustomer = userRole === "customer";

  // Protect dashboard routes - redirect to login if not authenticated
  if (isOnDashboard && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect internal users from dashboard to admin
  if (isOnDashboard && isLoggedIn && isInternalUser) {
    return NextResponse.redirect(new URL("/admin", nextUrl));
  }

  // Protect admin routes - redirect to login if not authenticated
  if (isOnAdmin && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect customers from admin to dashboard
  if (isOnAdmin && isLoggedIn && isCustomer) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  // Redirect from login page based on role if already logged in
  if (isOnLoginPage && isLoggedIn) {
    if (isInternalUser) {
      return NextResponse.redirect(new URL("/admin", nextUrl));
    } else {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
