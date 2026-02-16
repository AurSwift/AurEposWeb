"use client";

import Link from "next/link";
import { DataTable, ColumnDef } from "@/components/admin/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

type Release = {
  id: string;
  version: string;
  releaseDate: Date | null;
  title: string;
  summary: string;
  isMajor: boolean | null;
  type: string | null;
  published: boolean | null;
  createdAt: Date | null;
};

type ReleasesTableProps = {
  data: Release[];
};

export function ReleasesTable({ data }: ReleasesTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState<string | null>(null);

  const handleDelete = async (id: string, version: string) => {
    if (!confirm(`Are you sure you want to delete release v${version}?`)) {
      return;
    }

    setIsDeleting(id);

    try {
      const response = await fetch(`/api/admin/releases/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete release");
      }

      toast({
        title: "Success",
        description: `Release v${version} deleted successfully`,
      });

      router.refresh();
    } catch (error) {
      console.error("Error deleting release:", error);
      toast({
        title: "Error",
        description: "Failed to delete release",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleTogglePublish = async (
    id: string,
    currentStatus: boolean,
    version: string
  ) => {
    setIsToggling(id);

    try {
      const response = await fetch(`/api/admin/releases/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ published: !currentStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update release");
      }

      toast({
        title: "Success",
        description: `Release v${version} ${
          !currentStatus ? "published" : "unpublished"
        } successfully`,
      });

      router.refresh();
    } catch (error) {
      console.error("Error toggling publish status:", error);
      toast({
        title: "Error",
        description: "Failed to update release",
        variant: "destructive",
      });
    } finally {
      setIsToggling(null);
    }
  };

  const columns: ColumnDef<Release>[] = [
    {
      header: "Version",
      accessorKey: "version",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium">v{row.version}</span>
          {row.isMajor && (
            <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              Major
            </Badge>
          )}
        </div>
      ),
    },
    {
      header: "Title",
      accessorKey: "title",
      cell: (row) => (
        <div className="max-w-md">
          <div className="font-medium text-foreground">{row.title}</div>
          <div className="text-sm text-muted-foreground line-clamp-1">
            {row.summary}
          </div>
        </div>
      ),
    },
    {
      header: "Type",
      accessorKey: "type",
      filterable: true,
      filterOptions: [
        { label: "Major", value: "major" },
        { label: "Minor", value: "minor" },
        { label: "Patch", value: "patch" },
      ],
      cell: (row) => {
        const typeColors: Record<string, string> = {
          major: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
          minor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
          patch: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        };
        return (
          <Badge variant="outline" className={typeColors[row.type || "minor"]}>
            {row.type || "minor"}
          </Badge>
        );
      },
    },
    {
      header: "Status",
      accessorKey: "published",
      filterable: true,
      filterOptions: [
        { label: "Published", value: "true" },
        { label: "Draft", value: "false" },
      ],
      cell: (row) => (
        <Badge
          variant="outline"
          className={
            row.published
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
          }
        >
          {row.published ? "Published" : "Draft"}
        </Badge>
      ),
    },
    {
      header: "Release Date",
      accessorKey: "releaseDate",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.releaseDate ? format(new Date(row.releaseDate), "MMM d, yyyy") : "N/A"}
        </span>
      ),
    },
    {
      header: "Actions",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/admin/releases/${row.id}/edit`}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                handleTogglePublish(row.id, row.published || false, row.version)
              }
              disabled={isToggling === row.id}
            >
              {row.published ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Unpublish
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Publish
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDelete(row.id, row.version)}
              disabled={isDeleting === row.id}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search releases..."
      searchKeys={["version", "title", "summary"]}
      pageSize={20}
      emptyMessage="No releases found"
    />
  );
}
