import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Require authentication
  if (!session?.user) {
    redirect("/login");
  }

  // Redirect internal users to admin dashboard
  if (
    session.user.role === "admin" ||
    session.user.role === "support" ||
    session.user.role === "developer"
  ) {
    redirect("/admin");
  }

  const companyName = session.user.name || "User";

  return (
    <div className="min-h-screen bg-neutral-light">
      <DashboardHeader companyName={companyName} />
      {children}
    </div>
  );
}

