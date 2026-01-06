import { NextRequest } from "next/server";
import { getUserData } from "@/lib/auth-utils";
import { requireAuth } from "@/lib/api/auth-helpers";
import { successResponse, handleApiError } from "@/lib/api/response-helpers";

export async function GET(_request: NextRequest) {
  try {
    const session = await requireAuth();
    const userData = await getUserData(session.user.id);

    if (!userData) {
      throw new Error("User not found");
    }

    return successResponse(userData);
  } catch (error) {
    return handleApiError(error, "Failed to get user data");
  }
}


