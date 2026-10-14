CREATE TYPE "public"."estado_tramo" AS ENUM('borrador', 'publicado');--> statement-breakpoint
CREATE TYPE "public"."tipo_lugar" AS ENUM('dormir', 'comer', 'ver');--> statement-breakpoint
CREATE TABLE "caminos" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"color" text NOT NULL,
	CONSTRAINT "caminos_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "etapas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tramo_id" uuid NOT NULL,
	"posicion" integer NOT NULL,
	"titulo" text NOT NULL,
	"fecha" date,
	"origen" text,
	"origen_lat" double precision,
	"origen_lon" double precision,
	"destino" text,
	"destino_lat" double precision,
	"destino_lon" double precision,
	"via" jsonb,
	"notas" text,
	"km" numeric(6, 2),
	"desnivel_pos" integer,
	"desnivel_neg" integer,
	"traza" jsonb,
	"traza_origen" text DEFAULT 'carretera' NOT NULL,
	"bbox" jsonb,
	"gpx_key" text,
	CONSTRAINT "etapas_tramo_id_posicion_unique" UNIQUE("tramo_id","posicion") DEFERRABLE INITIALLY DEFERRED,
	CONSTRAINT "etapas_traza_origen_check" CHECK ("etapas"."traza_origen" in ('carretera', 'gpx', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "fotos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tramo_id" uuid NOT NULL,
	"etapa_id" uuid,
	"key_grande" text NOT NULL,
	"key_mini" text NOT NULL,
	"ancho" integer NOT NULL,
	"alto" integer NOT NULL,
	"pie" text,
	"tomada_en" timestamp with time zone,
	"lat" double precision,
	"lon" double precision,
	"mostrar_posicion" boolean DEFAULT true NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lugares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tramo_id" uuid NOT NULL,
	"etapa_id" uuid,
	"tipo" "tipo_lugar" NOT NULL,
	"nombre" text NOT NULL,
	"localidad" text,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"precio" smallint,
	"nota" text,
	"url" text,
	CONSTRAINT "lugares_lat_check" CHECK ("lugares"."lat" between -90 and 90),
	CONSTRAINT "lugares_lon_check" CHECK ("lugares"."lon" between -180 and 180),
	CONSTRAINT "lugares_precio_check" CHECK ("lugares"."precio" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "notas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tramo_id" uuid NOT NULL,
	"etapa_id" uuid,
	"fecha" date,
	"texto" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tramos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"anio" integer NOT NULL,
	"camino_id" integer NOT NULL,
	"titulo" text NOT NULL,
	"resumen" text,
	"fecha_inicio" date,
	"fecha_fin" date,
	"estado" "estado_tramo" DEFAULT 'borrador' NOT NULL,
	"km_total" numeric(7, 2) DEFAULT 0 NOT NULL,
	"desnivel_pos_total" integer DEFAULT 0 NOT NULL,
	"bbox" jsonb,
	"portada_foto_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tramos_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "etapas" ADD CONSTRAINT "etapas_tramo_id_tramos_id_fk" FOREIGN KEY ("tramo_id") REFERENCES "public"."tramos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_tramo_id_tramos_id_fk" FOREIGN KEY ("tramo_id") REFERENCES "public"."tramos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_etapa_id_etapas_id_fk" FOREIGN KEY ("etapa_id") REFERENCES "public"."etapas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lugares" ADD CONSTRAINT "lugares_tramo_id_tramos_id_fk" FOREIGN KEY ("tramo_id") REFERENCES "public"."tramos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lugares" ADD CONSTRAINT "lugares_etapa_id_etapas_id_fk" FOREIGN KEY ("etapa_id") REFERENCES "public"."etapas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas" ADD CONSTRAINT "notas_tramo_id_tramos_id_fk" FOREIGN KEY ("tramo_id") REFERENCES "public"."tramos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas" ADD CONSTRAINT "notas_etapa_id_etapas_id_fk" FOREIGN KEY ("etapa_id") REFERENCES "public"."etapas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tramos" ADD CONSTRAINT "tramos_camino_id_caminos_id_fk" FOREIGN KEY ("camino_id") REFERENCES "public"."caminos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tramos" ADD CONSTRAINT "tramos_portada_foto_id_fotos_id_fk" FOREIGN KEY ("portada_foto_id") REFERENCES "public"."fotos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fotos_tramo_id_orden_idx" ON "fotos" USING btree ("tramo_id","orden");--> statement-breakpoint
CREATE INDEX "lugares_tramo_id_idx" ON "lugares" USING btree ("tramo_id");--> statement-breakpoint
CREATE INDEX "notas_tramo_id_fecha_idx" ON "notas" USING btree ("tramo_id","fecha");