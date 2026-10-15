-- «Qué ver» deja de ser un tipo de lugar: pasa a los sitios de interés de su etapa.
-- 1. Los lugares sin etapa se asignan a la primera etapa de su tramo.
UPDATE "lugares" AS l SET "etapa_id" = (
  SELECT e."id" FROM "etapas" AS e WHERE e."tramo_id" = l."tramo_id" ORDER BY e."posicion" LIMIT 1
) WHERE l."etapa_id" IS NULL;--> statement-breakpoint
-- 2. Cada «qué ver» se añade a los sitios de interés de su etapa.
UPDATE "etapas" AS e SET "sitios" = e."sitios" || v."nuevos"
FROM (
  SELECT "etapa_id", jsonb_agg(
    jsonb_build_object('nombre', "nombre", 'localidad', "localidad", 'lat', "lat", 'lon', "lon", 'nota', "nota")
    ORDER BY "nombre"
  ) AS "nuevos"
  FROM "lugares" WHERE "tipo" = 'ver' AND "etapa_id" IS NOT NULL GROUP BY "etapa_id"
) AS v
WHERE e."id" = v."etapa_id";--> statement-breakpoint
-- 3. Se quitan los «qué ver» ya copiados y lo que no tiene etapa posible (tramos sin etapas).
DELETE FROM "lugares" WHERE "tipo" = 'ver' OR "etapa_id" IS NULL;--> statement-breakpoint
ALTER TABLE "lugares" DROP CONSTRAINT "lugares_etapa_id_etapas_id_fk";
--> statement-breakpoint
ALTER TABLE "lugares" ALTER COLUMN "tipo" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."tipo_lugar";--> statement-breakpoint
CREATE TYPE "public"."tipo_lugar" AS ENUM('dormir', 'comer');--> statement-breakpoint
ALTER TABLE "lugares" ALTER COLUMN "tipo" SET DATA TYPE "public"."tipo_lugar" USING "tipo"::"public"."tipo_lugar";--> statement-breakpoint
ALTER TABLE "lugares" ALTER COLUMN "etapa_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lugares" ADD CONSTRAINT "lugares_etapa_id_etapas_id_fk" FOREIGN KEY ("etapa_id") REFERENCES "public"."etapas"("id") ON DELETE cascade ON UPDATE no action;