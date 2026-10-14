# Nuestro Camino

Web de un grupo de amigos: un tramo del Camino de Santiago por año. Ver `docs/propuesta-tecnica.md`.

## Desarrollo local (Windows + Dropbox)

```powershell
npm run dropbox:ignore   # siempre antes de npm install
npm install
copy apps\api\.env.example apps\api\.env   # y rellénalo
npm run dev              # web en http://localhost:5173, API en http://localhost:3000
```

## Despliegue

Ambos servicios se construyen desde la **raíz** del monorepo (para que npm resuelva los workspaces y `packages/shared`).

**Netlify**: lo lee todo de `netlify.toml`. Base directory vacío; build `npm run build:web`; publish `apps/web/dist`.

**Render (Web Service, Node, plan Starter, región Frankfurt)**
- Root directory: vacío (raíz del repositorio)
- Build command: `npm ci --include=dev && npm run build:api` (con `NODE_ENV=production`, npm omitiría TypeScript)
- Start command: `npm run start:api`
- Health check path: `/api/health`
- Variables: `NODE_ENV=production` y las de `apps/api/.env.example`

Si el servicio de Render no se llama `caminos-api`, cambia la URL del proxy en `netlify.toml`.

**Worker de fotos (Cloudflare)**: `apps/fotos` sirve el bucket R2 `caminos-fotos` en https://caminos-fotos.j4alonso.workers.dev (solo `GET`/`HEAD` de `fotos/` y `pruebas/`). No se despliega solo:

```powershell
npx -w @caminos/fotos wrangler login   # una vez
npm run deploy -w @caminos/fotos
```

La regla CORS del bucket (Settings → CORS Policy) permite `PUT` desde `http://localhost:5173` y `https://santiagos.netlify.app`.
