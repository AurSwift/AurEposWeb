import { db } from "@/lib/db";
import { releases } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ReleaseForm } from "@/components/admin/release-form";

export default async function EditReleasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [release] = await db.select().from(releases).where(eq(releases.id, id));

  if (!release) {
    notFound();
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">
          Edit Release v{release.version}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Update release information and content
        </p>
      </div>

      <ReleaseForm initialData={release} />
    </div>
  );
}
