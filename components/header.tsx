"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function Header() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";

  const handleAnchorClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    hash: string
  ) => {
    // If we're on the home page, use smooth scroll
    if (pathname === "/") {
      e.preventDefault();
      const element = document.querySelector(hash);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
    // Otherwise, navigate to home page with hash
  };

  const handleLogout = async () => {
    await signOut({ redirect: true, callbackUrl: "/" });
  };

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="Aurswift Logo"
                width={60}
                height={48}
                className="h-12 w-15 object-cover"
                priority
              />
              <span className="text-xl font-bold text-foreground">
                Aurswift
              </span>
            </Link>
            <nav className="hidden md:flex gap-6">
              {pathname === "/" ? (
                <>
                  <a
                    href="#features"
                    onClick={(e) => handleAnchorClick(e, "#features")}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    Features
                  </a>
                  <Link
                    href="/pricing"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Pricing
                  </Link>
                  <Link
                    href="/contact"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Contact
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/#features"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Features
                  </Link>
                  <Link
                    href="/pricing"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Pricing
                  </Link>
                  <Link
                    href="/contact"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Contact
                  </Link>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Button 
                  variant="ghost" 
                  asChild 
                  className="hidden sm:inline-flex border border-border bg-background shadow-sm hover:shadow-md transition-shadow"
                >
                  <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
                <Button variant="outline" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild className="hidden sm:inline-flex">
                  <Link href="/login">Log in</Link>
                </Button>
                <Button asChild>
                  <Link href="/signup">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
