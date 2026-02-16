import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { db } from "@/lib/db";
import { releases } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
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

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allReleases = await db
      .select()
      .from(releases)
      .orderBy(desc(releases.releaseDate));

    return NextResponse.json(allReleases);
  } catch (error) {
    console.error("Error fetching releases:", error);
    return NextResponse.json(
      { error: "Failed to fetch releases" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = releaseSchema.parse(body);

    const [release] = await db
      .insert(releases)
      .values({
        ...validated,
        releaseDate: new Date(validated.releaseDate),
        createdBy: session.user.id,
      })
      .returning();

    return NextResponse.json(release, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error creating release:", error);
    return NextResponse.json(
      { error: "Failed to create release" },
      { status: 500 }
    );
  }
}
