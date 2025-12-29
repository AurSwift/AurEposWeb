import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const companyName = session.user.name || "User";

  return (
    <div className="min-h-screen bg-neutral-light">
      <DashboardHeader companyName={companyName} />
      {children}
    </div>
  );
}

