import { z } from "zod";

export const createTicketSchema = z.object({
  subject: z.string().min(3, "Subject must be at least 3 characters").max(255, "Subject must be less than 255 characters").trim(),
  category: z.enum([
    "technical",
    "billing",
    "license",
    "installation",
    "feature",
    "other",
  ], {
    errorMap: () => ({ message: "Invalid category" }),
  }),
  priority: z.enum(["low", "medium", "high", "urgent"], {
    errorMap: () => ({ message: "Invalid priority" }),
  }),
  message: z.string().min(10, "Message must be at least 10 characters").max(10000, "Message must be less than 10000 characters").trim(),
});

export const updateTicketSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  response: z.string().max(10000).trim().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});

export const replyTicketSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(10000, "Message must be less than 10000 characters").trim(),
  isInternal: z.boolean().default(false).optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type ReplyTicketInput = z.infer<typeof replyTicketSchema>;

