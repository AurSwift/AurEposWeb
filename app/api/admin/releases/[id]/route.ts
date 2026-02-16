import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { db } from "@/lib/db";
import { releases } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const releaseSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version must be in format X.Y.Z"),
  releaseDate: z.string(),
  title: z.string().min(1).max(255),
  summary: z.string().min(1),
  imageUrl: z.string().optional().nullable(),
  isMajor: z.boolean().default(false),
  type: z.enum(["major", "minor", "patch"]),
  features: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        icon: z.string(),
      })
    )
    .default([]),
  improvements: z
    .array(
      z.object({
        description: z.string(),
      })
    )
    .default([]),
  fixes: z
    .array(
      z.object({
        description: z.string(),
      })
    )
    .default([]),
  published: z.boolean().default(false),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const [release] = await db
      .select()
      .from(releases)
      .where(eq(releases.id, id));

    if (!release) {
      return NextResponse.json(
        { error: "Release not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(release);
  } catch (error) {
    console.error("Error fetching release:", error);
    return NextResponse.json(
      { error: "Failed to fetch release" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const validated = releaseSchema.parse(body);

    const [updatedRelease] = await db
      .update(releases)
      .set({
        ...validated,
        releaseDate: new Date(validated.releaseDate),
        updatedAt: new Date(),
      })
      .where(eq(releases.id, id))
      .returning();

    if (!updatedRelease) {
      return NextResponse.json(
        { error: "Release not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedRelease);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error updating release:", error);
    return NextResponse.json(
      { error: "Failed to update release" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const [deletedRelease] = await db
      .delete(releases)
      .where(eq(releases.id, id))
      .returning();

    if (!deletedRelease) {
      return NextResponse.json(
        { error: "Release not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting release:", error);
    return NextResponse.json(
      { error: "Failed to delete release" },
      { status: 500 }
    );
  }
}
