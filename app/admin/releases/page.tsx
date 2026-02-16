import { db } from "@/lib/db";
import { releases } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { ReleasesTable } from "@/components/admin/releases-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function AdminReleasesPage() {
  const allReleases = await db.select().from(releases).orderBy(desc(releases.releaseDate));

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Release Management</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create and manage product release notes for customers
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/releases/new">
            <Plus className="h-4 w-4 mr-2" />
            New Release
          </Link>
        </Button>
      </div>

      <ReleasesTable data={allReleases} />
    </div>
  );
}
