ALTER TABLE "lugares" ADD COLUMN "valoracion" smallint;--> statement-breakpoint
ALTER TABLE "lugares" ADD COLUMN "foto_id" uuid;--> statement-breakpoint
ALTER TABLE "lugares" ADD CONSTRAINT "lugares_foto_id_fotos_id_fk" FOREIGN KEY ("foto_id") REFERENCES "public"."fotos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lugares" ADD CONSTRAINT "lugares_valoracion_check" CHECK ("lugares"."valoracion" between 1 and 5);