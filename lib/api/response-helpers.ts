import { NextResponse } from "next/server";
import { CustomerNotFoundError } from "@/lib/db/customer-helpers";
import { UnauthorizedError } from "@/lib/api/auth-helpers";

/**
 * Standard API error response
 * Provides consistent error formatting across all API routes
 *
 * @param message - Error message to return
 * @param status - HTTP status code (default: 400)
 * @returns NextResponse with error
 *
 * @example
 * return errorResponse("Invalid input", 400);
 */
export function errorResponse(
  message: string,
  status: number = 400
): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Standard API success response
 * Provides consistent success formatting
 *
 * @param data - Data to return
 * @param status - HTTP status code (default: 200)
 * @returns NextResponse with data
 *
 * @example
 * return successResponse({ user: userData }, 200);
 */
export function successResponse<T>(
  data: T,
  status: number = 200
): NextResponse<T> {
  return NextResponse.json(data, { status });
}

/**
 * Handle known error types and return appropriate responses
 * Centralizes error handling logic
 *
 * @param error - Error object (can be any type)
 * @param fallbackMessage - Message to use if error is unknown
 * @returns NextResponse with appropriate error and status code
 *
 * @example
 * try {
 *   const customer = await getCustomerOrThrow(userId);
 *   return successResponse(customer);
 * } catch (error) {
 *   return handleApiError(error, "Failed to fetch customer");
 * }
 */
export function handleApiError(
  error: unknown,
  fallbackMessage: string = "An error occurred"
): NextResponse<{ error: string }> {
  // Log the error for debugging
  console.error("API Error:", error);

  // Handle CustomerNotFoundError
  if (error instanceof CustomerNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // Handle UnauthorizedError
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  // Handle ValidationError
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Handle ForbiddenError
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  // Handle generic Error
  if (error instanceof Error) {
    return NextResponse.json(
      { error: error.message || fallbackMessage },
      { status: 500 }
    );
  }

  // Unknown error type
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

/**
 * Validation error for bad request data
 */
export class ValidationError extends Error {
  public readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Forbidden error for insufficient permissions
 */
export class ForbiddenError extends Error {
  public readonly statusCode = 403;

  constructor(message: string = "Forbidden - Insufficient permissions") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Not found error for missing resources
 */
export class NotFoundError extends Error {
  public readonly statusCode = 404;

  constructor(message: string = "Resource not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Conflict error for duplicate resources
 */
export class ConflictError extends Error {
  public readonly statusCode = 409;

  constructor(message: string = "Resource already exists") {
    super(message);
    this.name = "ConflictError";
  }
}
