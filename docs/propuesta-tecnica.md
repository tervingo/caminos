# Nuestro Camino · Propuesta técnica de implementación

Oct 14, 2026 · @Juan Alberto Alonso

## Resumen y decisiones clave

Recomiendo un monorepo en GitHub con una SPA React en Netlify, una API Node en Render y PostgreSQL, con las fotos en almacenamiento de objetos y las rutas calculadas por carretera en el servidor. Es el camino más corto desde los mock-ups D hasta algo publicado, y cada pieza cabe en planes gratuitos o de pocos euros al mes.

| Área | Decisión | Por qué |
| --- | --- | --- |
| Repositorio | Monorepo en GitHub: `apps/web`, `apps/api`, `packages/shared` | Tipos compartidos entre frontend y API; Claude Code ve todo el proyecto a la vez |
| Frontend | React + Vite + TypeScript, React Router, TanStack Query | SPA estática para Netlify; el mock ya es una app con estado en cliente |
| Mapas | Leaflet (react-leaflet) con teselas de OpenStreetMap y GeoJSON | Mapa real con zoom península → tramo mediante `fitBounds` |
| Backend | Node LTS + Fastify + Zod, en TypeScript | Ligero, valida cada entrada y arranca rápido en Render |
| Base de datos | PostgreSQL en Neon (plan gratuito) con Drizzle ORM y migraciones SQL | Datos relacionales simples; las rutas van en JSONB, sin PostGIS en la v1 |
| Fotos | Cloudflare R2 con subida directa por URL prefirmada | Render no guarda archivos de forma duradera; así el API no mueve fotos |
| Acceso | Un único usuario autor con cookie httpOnly; lectura pública | Solo tú editas; el visitante no necesita cuenta |
| Origen único | Netlify reenvía `/api/*` a Render | Cookies de primera parte y sin CORS en producción |
| Calidad | GitHub Actions: tipos, lint y tests; despliegue automático desde `main` | Netlify y Render ya despliegan solos al hacer push |

Si prefieres Prisma a Drizzle, o Express a Fastify, el resto del diseño no cambia.

## Alcance y supuestos

La v1 es un sitio público de solo lectura, con un modo editor que solo usa el autor para publicar cada año.

**Incluye**

- Lista de años con filtro por Camino (Francés, Portugués, Lebaniego…).
- Página de cada tramo: etapas, mapa, fotos, lugares (dormir, comer, qué ver) y notas del autor.
- Mapa de la península con el tramo marcado y zoom hasta la zona, más capas de lugares y fotos.
- Modo editor: crear año o tramo, indicar origen, destino y paradas de cada etapa, subir fotos, añadir lugares y notas.

**Fuera de la v1**

- Comentarios de visitantes, varios autores y registro de usuarios.
- Modo sin conexión (PWA), exportar a PDF y búsqueda avanzada.

**Supuestos de partida**

1. Las rutas se calculan por carretera entre el origen y el destino de cada etapa (con paradas intermedias opcionales); el GPX queda para más adelante.
2. Cada año es independiente: un tramo es una entidad propia con su Camino, sin orden entre años.
3. Tráfico bajo (amigos y familia) y unas 100 a 300 fotos por año.
4. La web es pública y sin contraseña de visitantes; su dirección será nombre.netlify.app.
5. Interfaz solo en español.

## Arquitectura

```text
GitHub --despliega--> Netlify (web estática + proxy /api/*) y Render (API)
Navegador --> Netlify --proxy /api/*--> Render Starter --> Neon (PostgreSQL)
Render --firma subidas--> Cloudflare R2 <--lee-- Cloudflare Worker --fotos--> Navegador
Navegador <-- teselas -- OpenStreetMap
```

El navegador solo habla con Netlify: de ahí recibe la web y, por el proxy `/api/*`, llega al API de Render para editar. Las fotos se suben directo a R2 con una URL firmada por el API y se muestran a través de un Worker de Cloudflare, porque no hay dominio propio; el API de Render (plan Starter, siempre activo) guarda los datos en Neon y calcula las rutas por carretera. GitHub redespliega Netlify y Render con cada `push` a `main`.

## Frontend

El frontend es una SPA en React, Vite y TypeScript que convierte el mock D en rutas y componentes, desplegada como sitio estático en Netlify.

| Ruta | Contenido | Acceso |
| --- | --- | --- |
| `/` | Portada: estadísticas, tarjetas de años y filtro por Camino | Público |
| `/tramos/:slug` | Tramo: cabecera, etapas, mapa, fotos, lugares y notas | Público |
| `/admin/login` | Acceso del autor | Público |
| `/admin` | Lista de tramos con estado borrador o publicado | Autor |
| `/admin/tramos/:id` | Editor: datos, etapas con origen, destino y paradas, fotos, lugares y notas | Autor |

El `slug` de un tramo es legible, por ejemplo `2026-lebaniego`. La etapa elegida y el nivel de zoom viajan en la URL (`?etapa=2&vista=tramo`) para poder compartir un enlace exacto.

**Librerías**

- React Router para rutas y TanStack Query para datos del servidor, con caché y reintentos; sin Redux.
- Leaflet con react-leaflet para el mapa, y GeoJSON para las etapas.
- React Hook Form con Zod en los formularios del editor; los esquemas Zod viven en `packages/shared` y los comparte la API.
- Tailwind CSS con los colores y la tipografía del mock D (Newsreader e Instrument Sans, alojadas con la propia web).
- `exifr` para leer fecha y GPS de las fotos antes de subirlas.

**El mapa (`TripMap`)**

- Vista de península: límites fijos de la Península Ibérica y el tramo resaltado; los demás años salen como líneas finas con su año.
- Zoom al tramo: `flyToBounds` sobre el cuadro delimitador del tramo, desde el recuadro punteado, el interruptor Península o Zona, o al pulsar una etapa.
- Capas de etapas, dormir, comer, qué ver y fotos con marcadores `divIcon` como los del mock; los lugares solo se pintan desde cierto zoom.
- Los otros años se pintan con una geometría muy simplificada que llega en la lista de tramos; el detalle completo solo se pide al abrir el tramo.
- La URL de las teselas es una variable (`VITE_TILES_URL`) y la atribución de OpenStreetMap siempre es visible.
- El mapa se carga con `React.lazy` para no pesar en la portada.

**Estructura**

```text
apps/web/src/
  routes/        Home, TripPage, admin/*
  components/    YearCard, StageList, PlaceCard, PhotoGrid, TripMap/
  features/admin/ GpxUploader, PhotoUploader, PlaceForm, NoteForm
  lib/           cliente de API, formateo, utilidades geo
  styles/        tokens y estilos globales
```

Para accesibilidad se mantienen los botones y enlaces reales del mock, con `aria-label` en los marcadores del mapa y contraste mínimo 4,5:1.

## Backend y API

El backend es una API REST en JSON con Fastify y TypeScript que guarda los datos, calcula las rutas por carretera, procesa GPX opcionales y firma las subidas de fotos; solo el autor puede escribir.

| Endpoint | Acceso | Qué hace |
| --- | --- | --- |
| `GET /api/health` | Público | Comprobación de salud del servicio |
| `GET /api/caminos` | Público | Lista de Caminos con su color |
| `GET /api/tramos` | Público | Lista de tramos publicados, con ruta resumida y portada |
| `GET /api/tramos/:slug` | Público | Detalle: etapas en GeoJSON, lugares, fotos y notas |
| `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | Autor | Sesión por cookie |
| `POST/PATCH/DELETE /api/admin/tramos` | Autor | Crear, editar, borrar un tramo |
| `POST /api/admin/tramos/:id/publicar` | Autor | Pasa a publicado |
| `POST/PATCH/DELETE /api/admin/etapas` | Autor | Etapas, con origen, destino y paradas; `PUT` para reordenarlas |
| `POST /api/admin/uploads/firmar` | Autor | Devuelve una URL prefirmada para subir foto o GPX |
| `POST/PATCH/DELETE /api/admin/fotos` | Autor | Registra y edita fotos ya subidas |
| `POST/PATCH/DELETE /api/admin/lugares`, `/notas` | Autor | Lugares y notas de un tramo o etapa |

**Procesado de un GPX opcional, en el servidor**

1. El editor sube el archivo y la API lo lee con `@tmcw/togeojson`.
2. Calcula distancia por suma de tramos, desnivel positivo y negativo con un umbral de ruido de unos 3 m, y el cuadro delimitador.
3. Simplifica la traza con Douglas-Peucker (`@turf/simplify`) hasta un punto cada 10 a 20 m, suficiente para dibujar sin pesar.
4. Guarda la traza simplificada en JSONB, el GPX original en el almacenamiento y los totales en la etapa.
5. Devuelve la etapa ya calculada para que el editor la pinte al instante.

El total del tramo (km y desnivel) se recalcula sumando sus etapas.

**Convenciones**

- Zod valida cada entrada y los mismos esquemas están en `packages/shared`.
- Errores con forma única: `{ "error": { "code", "message", "details" } }`.
- `@fastify/rate-limit` en el login, `@fastify/helmet` y registros con pino.
- Tests con Vitest; la API de prueba usa un PostgreSQL real en CI, no un simulado.

## Base de datos

Usaremos PostgreSQL con siete tablas; las trazas de las etapas van en JSONB y las fotos solo guardan claves del almacenamiento, no archivos.

**Dónde alojarla.** La base gratuita de Render caduca a los 30 días y no tiene copias, así que no sirve para algo que quieres conservar.

| Opción | Coste | Notas |
| --- | --- | --- |
| Neon, plan gratuito | 0 | Permanente; 1 GB por proyecto; el cómputo se suspende a los 5 minutos sin uso; historial de 6 horas, por eso añadimos copia semanal |
| Render Postgres de pago | 6 $/mes | Mismo panel que el API; 1 GB incluido; sin caducidad |
| Render Postgres gratuito | 0 | Caduca a los 30 días; 1 GB; sin copias. No recomendable |

Recomiendo empezar con Neon gratuito: un año de texto, coordenadas y trazas simplificadas ocupa unas pocas centenas de KB, muy lejos del gigabyte disponible.

**Tablas**

| Tabla | Contiene | Campos principales |
| --- | --- | --- |
| `caminos` | Francés, Portugués, Lebaniego… | slug, nombre, color |
| `tramos` | Un año o tramo independiente | slug único, año, camino, título, resumen, fechas, estado, km y desnivel totales, cuadro delimitador, portada |
| `etapas` | Jornadas de un tramo, en orden | tramo, posición, título, fecha, origen, destino, notas, km, desniveles, traza (JSONB), clave del GPX |
| `lugares` | Dónde dormir, comer y qué ver | tramo, etapa opcional, tipo, nombre, localidad, lat, lon, precio 1 a 3, nota |
| `fotos` | Fotos con su posición | tramo, etapa opcional, claves grande y miniatura, tamaño, pie, fecha, lat, lon, orden |
| `notas` | Notas del autor | tramo, etapa opcional, fecha, texto |
| `usuarios` | El autor (un solo registro) | email, hash de la contraseña |

Un camino tiene muchos tramos; un tramo tiene muchas etapas, lugares, fotos y notas; lugares, fotos y notas pueden colgar además de una etapa concreta. Al borrar un tramo se borra todo lo suyo; al borrar una etapa, sus lugares, fotos y notas se conservan en el tramo.

**Esquema SQL (núcleo)**

```sql
create type estado_tramo as enum ('borrador', 'publicado');
create type tipo_lugar as enum ('dormir', 'comer', 'ver');

create table caminos (
  id serial primary key,
  slug text not null unique,
  nombre text not null,
  color text not null
);

create table tramos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  anio int not null,
  camino_id int not null references caminos(id),
  titulo text not null,
  resumen text,
  fecha_inicio date,
  fecha_fin date,
  estado estado_tramo not null default 'borrador',
  km_total numeric(7,2) not null default 0,
  desnivel_pos_total int not null default 0,
  bbox jsonb,
  portada_foto_id uuid,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table etapas (
  id uuid primary key default gen_random_uuid(),
  tramo_id uuid not null references tramos(id) on delete cascade,
  posicion int not null,
  titulo text not null,
  fecha date,
  origen text, origen_lat double precision, origen_lon double precision, destino text, destino_lat double precision, destino_lon double precision, via jsonb,
  notas text,
  km numeric(6,2),
  desnivel_pos int,
  desnivel_neg int,
  traza jsonb, traza_origen text not null default 'carretera' check (traza_origen in ('carretera', 'gpx', 'manual')),
  bbox jsonb,
  gpx_key text,
  unique (tramo_id, posicion) deferrable initially deferred
);

create table lugares (
  id uuid primary key default gen_random_uuid(),
  tramo_id uuid not null references tramos(id) on delete cascade,
  etapa_id uuid references etapas(id) on delete set null,
  tipo tipo_lugar not null,
  nombre text not null,
  localidad text,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  precio smallint check (precio between 1 and 3),
  nota text,
  url text
);

create table fotos (
  id uuid primary key default gen_random_uuid(),
  tramo_id uuid not null references tramos(id) on delete cascade,
  etapa_id uuid references etapas(id) on delete set null,
  key_grande text not null,
  key_mini text not null,
  ancho int not null,
  alto int not null,
  pie text,
  tomada_en timestamptz,
  lat double precision,
  lon double precision,
  mostrar_posicion boolean not null default true,
  orden int not null default 0
);

alter table tramos
  add foreign key (portada_foto_id) references fotos(id) on delete set null;

create table notas (
  id uuid primary key default gen_random_uuid(),
  tramo_id uuid not null references tramos(id) on delete cascade,
  etapa_id uuid references etapas(id) on delete set null,
  fecha date,
  texto text not null
);

create table usuarios (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null
);

create index on lugares (tramo_id);
create index on fotos (tramo_id, orden);
create index on notas (tramo_id, fecha);
```

**Migraciones y copias**

- El esquema vive en `apps/api/src/db/schema.ts` (Drizzle); `drizzle-kit` genera las migraciones SQL, que se guardan en el repositorio y se aplican al arrancar el API.
- `npm run db:seed` carga los cuatro tramos de ejemplo de los mock-ups, para desarrollar el frontend con datos reales desde el primer día.
- Un flujo semanal de GitHub Actions hace `pg_dump` y lo sube al bucket privado de R2, conservando las últimas 8 copias.

## Fotos, GPX y mapas

Las fotos nunca pasan por el API: el navegador las sube directo a Cloudflare R2 con una URL prefirmada, y el API solo guarda los metadatos.

**Subida de fotos (modo editor)**

1. Arrastras varias fotos al editor del tramo.
2. El navegador lee la fecha y las coordenadas con `exifr` y genera dos versiones con canvas: miniatura de unos 480 px y grande de unos 2000 px, ambas en WebP. El original no se sube (así se eliminan también los datos EXIF de ubicación que no quieras publicar).
3. Pide al API `POST /api/admin/uploads/firmar` una URL de subida por archivo y sube cada versión con `PUT` directo a R2.
4. Llama a `POST /api/admin/fotos` con las claves, medidas, fecha y posición.
5. El editor asigna cada foto a su etapa comparando la fecha con la de las etapas; si no hay fecha, la deja en el tramo para que la coloques a mano. Las coordenadas de la foto se pueden ocultar con `mostrar_posicion`.

**Cómo se sirven las fotos.** Sin dominio propio no se puede conectar un dominio al bucket, y la dirección `r2.dev` que da Cloudflare está pensada solo para desarrollo, con límite de peticiones y sin caché. La propuesta es poner delante del bucket un Worker de Cloudflare (gratuito: 100.000 peticiones al día), que lee las fotos con un acceso directo al bucket y las entrega desde una dirección `nombre.workers.dev`, con cabeceras de caché largas. Es un archivo de unas 20 líneas dentro del repositorio. Queda por confirmar en la fase 0 que la dirección `workers.dev` está disponible en el plan gratuito; si no lo estuviera, las fotos pasarían por el API de Render, que ahora está siempre activo.

**Rutas en el bucket**

| Ruta | Contenido |
| --- | --- |
| `fotos/{tramo}/{id}-mini.webp` | Miniatura |
| `fotos/{tramo}/{id}-grande.webp` | Versión grande |
| `gpx/{tramo}/{etapa}.gpx` | GPX original de la etapa |
| `publico/tramos/{slug}.json` | Instantánea del tramo (opcional, más adelante) |
| `publico/indice.json` | Índice para la portada (opcional, más adelante) |
| `copias/` | Copias semanales de la base de datos (bucket privado) |

**Recorrido por carretera (primera versión).** En el editor indicas el origen y el destino de cada etapa, buscando la localidad por su nombre o haciendo clic en el mapa. Al guardar, el API pide la ruta de A a B a un servicio de rutas y guarda la línea resultante en `etapas.traza`, con su distancia en `km`; el resultado se calcula una sola vez y se reutiliza. Detalles:

- **Proveedor:** [OpenRouteService](https://openrouteservice.org/), con clave gratuita y límites diarios y por minuto que se ven al registrarse (para unas pocas etapas al año sobran). Admite hasta 50 puntos por petición y rutas de hasta 6.000 km. La clave vive solo en Render (`ORS_API_KEY`), nunca en el navegador.
- **Alternativa:** el servidor público de OSRM, que solo admite uso razonable y no comercial, un máximo de una petición por segundo y sin garantías; vale para pruebas, no para producción.
- **Perfil:** coche por defecto, como indicas; el mismo servicio ofrece perfiles a pie, y cambiar a uno de ellos es un parámetro del editor, no un cambio de diseño.
- **Puntos intermedios:** se pueden añadir paradas en la ruta (`etapas.via`) para forzar un paso concreto cuando la carretera elegida no coincide con lo caminado.
- **Desnivel:** una ruta por carretera no refleja el desnivel real del camino, así que en esta versión queda vacío salvo que el servicio devuelva altitud.
- **Aviso en pantalla:** la línea se muestra como *Recorrido aproximado por carretera*, porque el Camino rara vez va por la calzada.
- **Endpoint nuevo:** `POST /api/admin/etapas/:id/calcular-ruta`, que recalcula la traza cuando cambias origen, destino o paradas.

GPX opcional, para más adelante. Subes el archivo exportado de Wikiloc, Komoot o Garmin. El API lo procesa en cinco pasos: lectura con `@tmcw/togeojson`, distancia por haversine, desnivel acumulado ignorando variaciones menores de unos 3 m, simplificación con `@turf/simplify` a 10–20 m de tolerancia y cálculo del cuadro delimitador. Guarda la traza simplificada en `etapas.traza` y el original en R2. Cuando una etapa tenga GPX, sustituye a la ruta por carretera y `traza_origen` pasa a `gpx`.

**Mapas (Leaflet)**

- La vista inicial muestra la península con todos los tramos como marcadores por año; al abrir un tramo, `flyToBounds` encuadra su cuadro delimitador y el usuario puede alejar o acercar libremente, como en el mock-up.
- Las etapas se dibujan como líneas con el color del camino; los lugares y las fotos con posición, como marcadores agrupables por capa (Etapas, Dormir, Comer, Qué ver, Fotos, Otros años).
- Las teselas de OpenStreetMap se cargan desde una URL configurable (`VITE_TILES_URL`), con la atribución siempre visible. La política de OSM no permite descargas masivas ni uso sin conexión y pide un uso moderado; para una web de amigos basta. Si algún día hubiera mucho tráfico, se cambia la variable a un proveedor con plan gratuito sin tocar código.
- La página del tramo no carga el mapa hasta que se acerca a la pantalla, para que la lectura inicial sea rápida.

## Seguridad y acceso

Solo el autor puede escribir: un único usuario con contraseña, sesión en cookie httpOnly y rutas `/api/admin/*` protegidas; la lectura es pública.

- **Alta del autor.** Un script (`npm run crear-autor`) crea el único registro de `usuarios`; no hay endpoint público de registro.
- **Contraseña.** Hash con argon2id; nunca se guarda en claro.
- **Sesión.** JWT firmado con `JWT_SECRET` en una cookie `httpOnly; Secure; SameSite=Lax` de 7 días; cerrar sesión la borra.
- **Origen único.** Con el proxy de Netlify el navegador solo habla con tu dominio, así que en producción no hace falta CORS; en local se permite `http://localhost:5173`.
- **Cookies a través del proxy.** La documentación de Netlify no detalla cómo trata las cookies, así que la fase 0 incluye una prueba; si fallase, plan B: token en memoria con cabecera `Authorization` y refresco.
- **Escrituras.** El API comprueba la cabecera `Origin` y exige `Content-Type: application/json`, además de `SameSite=Lax`, como defensa frente a CSRF.
- **Límites.** 5 intentos de login por minuto y por IP con `@fastify/rate-limit`; GPX de hasta 5 MB; fotos solo JPEG, WebP o PNG; el API verifica tamaño y tipo del archivo subido antes de registrarlo y borra el que no cumpla.
- **Secretos.** Solo en variables de entorno de Render y Netlify; el repositorio incluye un `.env.example` sin valores reales.
- **Cabeceras.** `@fastify/helmet` en el API; en Netlify, `X-Content-Type-Options` y una política CSP que permita solo tu dominio, el de las fotos y el de las teselas.
- **Dependencias.** Dependabot y `npm audit` en la integración continua.

Al ser una web pública no hay contraseña de visitantes: cualquiera con el enlace puede ver tramos publicados. Los tramos en borrador solo se ven en el modo editor.

## Despliegue y entornos

Un solo repositorio en GitHub: cada `push` a `main` redespliega Netlify (frontend) y Render (API); las ramas y los pull requests generan una vista previa en Netlify.

**Entornos**

| Entorno | Frontend | API | Base de datos |
| --- | --- | --- | --- |
| Local | Vite en `localhost:5173` con proxy `/api` | `localhost:3000` | Postgres en Docker o rama de Neon |
| Producción | Netlify | Render | Neon (o Render de pago) |

**`netlify.toml`**

```toml
[build]
  base = "apps/web"
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/api/*"
  to = "https://nuestro-camino-api.onrender.com/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

La regla de `/api/*` va primero para que no la capture la del SPA. El nombre del servicio de Render es un ejemplo.

**Render (servicio web)**

- Tipo: Web Service con Node; raíz del repositorio `apps/api`.
- Build: `npm ci && npm run build`. Start: `npm run start` (aplica migraciones y arranca Fastify).
- Comprobación de salud: `/api/health`.
- Plan Starter (7 $ al mes): siempre activo, sin esperas de arranque.

**Variables de entorno**

| Variable | Dónde | Uso |
| --- | --- | --- |
| `DATABASE_URL` | Render | Cadena de conexión a Postgres |
| `JWT_SECRET` | Render | Firma de la cookie de sesión |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Render | Firmar subidas de fotos |
| `PUBLIC_ASSETS_URL` | Render y Netlify | Dirección pública de las fotos (Worker de Cloudflare) |
| `ALLOWED_ORIGIN` | Render | Solo para desarrollo local |
| `VITE_TILES_URL`, `VITE_ASSETS_URL` | Netlify | Teselas y fotos en el navegador |

**Integración continua (GitHub Actions)**

- En cada pull request: instalar, `lint`, `typecheck`, pruebas de Vitest y compilar frontend y API.
- Semanal: `pg_dump` hacia el bucket de copias.
- Netlify y Render despliegan solos desde `main`; los despliegues solo ocurren si la integración continua pasa (protección de rama en GitHub).

**Lectura y publicación.** La web pública lee los tramos publicados del API a través del proxy de Netlify, con cabeceras de caché; *Publicar* cambia el estado de borrador a publicado. Con Render Starter no hay arranques lentos, así que no hacen falta instantáneas en R2 (se podrían añadir más adelante como optimización). Recuerda añadir `ORS_API_KEY`, la clave de OpenRouteService, a las variables de Render.

## Plan por fases

Seis fases cortas; al terminar cada una hay algo que se puede abrir y probar en Netlify.

| Fase | Objetivo | Resultado comprobable |
| --- | --- | --- |
| 0. Cimientos | Monorepo, CI, Netlify y Render conectados, base en Neon, **prueba de cookie a través del proxy** y de subida a R2, y de servir fotos con un Worker en workers.dev | `/api/health` responde desde el dominio de Netlify y una cookie de prueba se guarda |
| 1. Datos y API | Esquema, migraciones, semilla con los 4 tramos de ejemplo, endpoints de lectura, login | La API devuelve los tramos de ejemplo |
| 2. Web pública | Portada, página de tramo con etapas, lugares, notas y galería, con los estilos del mock-up D | Navegar la web completa con datos de ejemplo |
| 3. Mapa | Leaflet con península, zoom al tramo, etapas, capas, marcadores y ventanas emergentes | El mapa se comporta como en el mock-up, con teselas reales |
| 4. Editor | Alta y edición de tramos, etapas, lugares y notas; recorrido por carretera con paradas; subida de fotos con asignación por fecha y GPS | Crear el tramo de este año (Lebaniego) desde el navegador |
| 5. Publicación y pulido | Caché de lecturas, copias semanales, accesibilidad, rendimiento | Web pública rápida y con copias de seguridad |

Puedes dejar las fases 4 y 5 para después de las 0 a 3: con la semilla ya se ve el sitio, y los tramos reales los cargarías cuando el editor esté listo.

**Para empezar en el IDE.** Sugerencia de `CLAUDE.md` en la raíz del repositorio, para que Claude Code mantenga el contexto entre sesiones:

```markdown
# Nuestro Camino

Web pública de un grupo de amigos: un tramo del Camino de Santiago por año, con etapas, mapa, fotos, lugares y notas. Solo el autor edita.

## Estructura
- apps/web: React + Vite + TypeScript, Tailwind, React Router, TanStack Query, Leaflet
- apps/api: Fastify + Zod + Drizzle, PostgreSQL
- packages/shared: tipos y esquemas Zod compartidos

## Reglas
- Cada tramo (año) es independiente; no asumir continuidad entre años ni que el camino sea el Francés.
- Las fotos van directas a R2 con URL prefirmada y se sirven con un Worker de Cloudflare; nunca pasan por el API.
- Los recorridos se calculan por carretera con OpenRouteService (origen, destino y paradas); el GPX es opcional y futuro.
- Textos de la interfaz en español; código e identificadores en español para el dominio (tramo, etapa, lugar), inglés para lo técnico.
- Diseño: seguir el mock-up D (Newsreader + Instrument Sans, mismos colores).
- Mostrar siempre la atribución de OpenStreetMap en los mapas.
- El repositorio local está en una carpeta de Dropbox en Windows: antes de `npm install`, ejecutar `npm run dropbox:ignore` para que Dropbox no sincronice `node_modules` ni `dist`. Nunca guardar secretos en el repositorio.

## Comandos
- npm run dev, npm run test, npm run lint, npm run db:migrate, npm run db:seed
```

**Repositorio dentro de Dropbox (Windows).** Dropbox no tiene un archivo de exclusión: se marca cada carpeta con un atributo (`com.dropbox.ignored`). Hay que hacerlo con la carpeta ya creada y antes de `npm install`, para que Dropbox no empiece a subir miles de archivos. La fase 0 incluye este script y la entrada `"dropbox:ignore": "powershell -ExecutionPolicy Bypass -File scripts/dropbox-ignore.ps1"` en el `package.json` de la raíz:

```powershell
# scripts/dropbox-ignore.ps1 (ejecutar desde la raíz del repositorio)
$carpetas = @(
  'node_modules',
  'apps/web/node_modules',
  'apps/api/node_modules',
  'packages/shared/node_modules',
  'apps/web/dist',
  'apps/api/dist'
)
foreach ($c in $carpetas) {
  New-Item -ItemType Directory -Force -Path $c | Out-Null
  Set-Content -Path $c -Stream com.dropbox.ignored -Value 1
}
```

Tres avisos: la carpeta `.git` dentro de Dropbox puede corromperse si se abre el repositorio desde dos ordenadores a la vez, así que la copia real es GitHub; los secretos van en las variables de Render y Netlify y en un `.env` local que no se sube; y el script debe volver a ejecutarse si aparece alguna carpeta `node_modules` nueva.

## Costes, riesgos y preguntas abiertas

El coste previsto es de unos 7 $ al mes, el plan Starter de Render; el resto cabe en planes gratuitos.

**Costes (precios consultados el 14 de octubre de 2026)**

| Servicio | Plan | Coste |
| --- | --- | --- |
| GitHub | Gratuito | 0 |
| Netlify | Gratuito | 0 |
| Render, API | Starter (siempre activo) | 7 $ al mes |
| Neon, Postgres | Gratuito (1 GB) | 0 |
| Cloudflare R2 | 10 GB al mes, 1 M operaciones de escritura y 10 M de lectura gratis; sin cargo por salida | 0 en este volumen |
| Teselas de OSM | Uso moderado | 0 |
| Dirección de Netlify (nombre.netlify.app) | Incluida en Netlify | 0 |

Un tramo de unas 100 fotos en miniatura y versión grande ocupa del orden de 40 a 60 MB, así que los 10 GB de R2 dan para muchos años.

**Riesgos y cómo se cubren**

| Riesgo | Mitigación |
| --- | --- |
| Netlify corta las peticiones del proxy a los 26 s | El API de Render Starter está siempre activo; las fotos no pasan por el proxy; las rutas se calculan una sola vez |
| La base de datos gratuita de Render caduca a los 30 días | No se usa; Neon gratuito (o Render de pago) |
| Neon gratuito tiene solo 6 horas de historial | Copia semanal con `pg_dump` a R2 |
| Netlify puede no reenviar bien las cookies | Prueba en la fase 0; plan B con token en cabecera |
| `r2.dev` no es apto para producción y no hay dominio propio | Worker de Cloudflare en workers.dev delante del bucket (confirmar en la fase 0) |
| OSM puede limitar o bloquear su servidor de teselas | URL configurable y atribución visible; cambio de proveedor sin tocar código |
| Los datos de ejemplo del mock-up son aproximados | La semilla se sustituye por tramos reales con GPX |

**Preguntas abiertas**

1. **GPX:** resuelta: en la primera versión el recorrido se calcula por carretera entre el origen y el destino de cada etapa; el GPX queda para más adelante. Las paradas intermedias para acercar la línea al camino real se incluyen en la primera versión.
2. **Pública o privada:** resuelta: es pública, sin contraseña de visitantes.
3. **Dominio:** resuelta: se usará nombre.netlify.app (el nombre, por decidir). Sin dominio propio, las fotos se sirven con un Worker de Cloudflare; se confirma en la fase 0.
4. **Pago de 7 $ al mes:** resuelta: plan Starter de Render, siempre activo.
5. **Cambios pendientes del mock-up D:** dijiste que querrías hacer algunos cambios; solo concretaste el del mapa.

**Fuentes**

- [Render, planes gratuitos](https://render.com/docs/free)
- [Render, precios](https://render.com/pricing)
- [Netlify, redirecciones y proxy](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/)
- [Neon, planes](https://neon.com/docs/introduction/plans)
- [Cloudflare R2, precios](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare R2, buckets públicos](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [Política de uso de teselas de OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/)
