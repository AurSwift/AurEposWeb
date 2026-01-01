ALTER TABLE "ticket_attachments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ticket_threads" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "ticket_attachments" CASCADE;--> statement-breakpoint
DROP TABLE "ticket_threads" CASCADE;--> statement-breakpoint
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_ticket_number_unique";--> statement-breakpoint
DROP INDEX "support_tickets_ticket_number_idx";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "ticket_number";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "first_response_at";--> statement-breakpoint
ALTER TABLE "support_tickets" DROP COLUMN "resolved_at";