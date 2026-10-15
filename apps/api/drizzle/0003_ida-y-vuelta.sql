ALTER TABLE "etapas" ADD COLUMN "tipo" text DEFAULT 'camino' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "etapas_tramo_id_tipo_viaje_idx" ON "etapas" USING btree ("tramo_id","tipo") WHERE "etapas"."tipo" <> 'camino';--> statement-breakpoint
ALTER TABLE "etapas" ADD CONSTRAINT "etapas_tipo_check" CHECK ("etapas"."tipo" in ('camino', 'ida', 'vuelta'));