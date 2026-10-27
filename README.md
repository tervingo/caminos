# Nuestro Camino

Web de un grupo de amigos: un tramo del Camino de Santiago por año. Ver `docs/propuesta-tecnica.md`.

## Desarrollo local (Windows + Dropbox)

```powershell
npm run dropbox:ignore   # siempre antes de npm install
npm install
copy apps\api\.env.example apps\api\.env   # y rellénalo
npm run db:seed          # migra y carga los 4 tramos de ejemplo (repetible)
npm run dev              # web en http://localhost:5173, API en http://localhost:3000
```

## Base de datos

- El esquema está en `apps/api/src/db/schema.ts`. Tras cambiarlo, `npm run db:generate` crea la migración SQL en `apps/api/drizzle/`, que se sube al repositorio.
- El API aplica las migraciones al arrancar; `npm run db:migrate` lo hace a mano.
- `npm run crear-autor -- tu@email.com` crea el autor o le cambia la contraseña (la pide sin mostrarla).
- Para actuar sobre **producción** desde tu PC, la variable del entorno manda sobre el `.env`:

  ```powershell
  $env:DATABASE_URL = "<cadena de la rama main>"
  npm run db:seed
  npm run crear-autor -- tu@email.com
  Remove-Item Env:DATABASE_URL
  ```

- Tests de integración: `TEST_DATABASE_URL` apunta a una base que se **borra entera** (en CI, un PostgreSQL de GitHub Actions). Sin ella, esos tests se saltan.

## API

| Endpoint | Acceso |
| --- | --- |
| `GET /api/health` | Público |
| `GET /api/caminos`, `GET /api/tramos`, `GET /api/tramos/:slug` | Público (solo tramos publicados) |
| `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | Autor (cookie `sesion`, 7 días) |
| `GET/POST /api/admin/tramos`, `GET/PATCH/DELETE /api/admin/tramos/:id`, `POST …/:id/publicar` y `…/despublicar` | Autor |
| `POST /api/admin/caminos` | Autor |
| `POST /api/admin/tramos/:id/etapas`, `PUT …/etapas/orden`, `PATCH/DELETE /api/admin/etapas/:id`, `POST …/:id/calcular-ruta` | Autor |
| `POST /api/admin/tramos/:id/lugares` y `/notas`, `PATCH/DELETE /api/admin/lugares/:id` y `/notas/:id` | Autor |
| `POST /api/admin/tramos/:id/fotos/firmar`, `POST …/:id/fotos`, `PATCH/DELETE /api/admin/fotos/:id` | Autor |
| `GET /api/admin/geo/buscar?q=[&lat=&lon=]`, `GET /api/admin/geo/inverso?lat=&lon=` | Autor (OpenRouteService y Nominatim juntos; con `lat`/`lon`, primero lo cercano) |

Las escrituras del editor devuelven el tramo completo (`TramoEditor`). Los totales del tramo (km, desnivel y recuadro) se recalculan solos. `calcular-ruta` usa OpenRouteService (`ORS_API_KEY`) y guarda la traza simplificada, los km y el desnivel. Un borrador se puede previsualizar en `/tramos/:slug` con la sesión del autor.

**Editor web**: `/admin` (enlace «Acceso del autor» al pie). Las fotos se reducen en el navegador a WebP de 2000 y 480 px (el original y sus EXIF no se suben), van directas a R2 con URL firmada y se asignan a su etapa por la fecha de la foto.

Las escrituras exigen la cabecera `Origin` de un origen permitido (`ALLOWED_ORIGIN`). Errores: `{ "error": { "code", "message", "details" } }`.

## Despliegue

Ambos servicios se construyen desde la **raíz** del monorepo (para que npm resuelva los workspaces y `packages/shared`).

**Netlify**: lo lee todo de `netlify.toml`. Base directory vacío; build `npm run build:web`; publish `apps/web/dist`. Opcional: `VITE_TILES_URL` y `VITE_TILES_ATTRIBUTION` para cambiar de proveedor de teselas (por defecto, OpenStreetMap con su atribución).

**Render (Web Service, Node, plan Starter, región Frankfurt)**
- Root directory: vacío (raíz del repositorio)
- Build command: `npm ci --include=dev && npm run build:api` (con `NODE_ENV=production`, npm omitiría TypeScript)
- Start command: `npm run start:api` (aplica las migraciones y arranca)
- Health check path: `/api/health`
- Variables: `NODE_ENV=production`, `DATABASE_URL` (rama main), `JWT_SECRET` (obligatoria), las de R2 y `ORS_API_KEY`

Si el servicio de Render no se llama `caminos-api`, cambia la URL del proxy en `netlify.toml`.

**Worker de fotos (Cloudflare)**: `apps/fotos` sirve el bucket R2 `caminos-fotos` en https://caminos-fotos.j4alonso.workers.dev (solo `GET`/`HEAD` de `fotos/`). La web no lo enlaza directamente: Netlify reenvía `/fotos/*` al Worker (ver `netlify.toml`) y en Render `PUBLIC_ASSETS_URL=https://encaminos.netlify.app`. Así las fotos se ven aunque un operador bloquee las direcciones de Cloudflare (como en España durante los partidos de LaLiga); la subida, que va directa a R2, sí falla mientras dure el bloqueo. No se despliega solo:

```powershell
npx -w @caminos/fotos wrangler login   # una vez
npm run deploy -w @caminos/fotos
```

La regla CORS del bucket (Settings → CORS Policy) permite `PUT` desde `http://localhost:5173` y `https://encaminos.netlify.app`.
