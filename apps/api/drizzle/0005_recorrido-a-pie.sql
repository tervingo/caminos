ALTER TABLE "etapas" ADD COLUMN "traza_pie" jsonb;--> statement-breakpoint
ALTER TABLE "etapas" ADD COLUMN "km_pie" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "etapas" ADD COLUMN "traza_pie_fuente" text;