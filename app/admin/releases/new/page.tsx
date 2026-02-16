import { ReleaseForm } from "@/components/admin/release-form";

export default function NewReleasePage() {
  return (
    <div className="px-4 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Create New Release</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add a new product release with features, improvements, and bug fixes
        </p>
      </div>

      <ReleaseForm />
    </div>
  );
}
