# Nuestro Camino

Web pública de un grupo de amigos: un tramo del Camino de Santiago por año, con etapas, mapa, fotos, lugares y notas. Solo el autor edita.

## Documentación
- Propuesta técnica completa: docs/propuesta-tecnica.md (léela antes de empezar cualquier fase).
- Referencia visual: docs/mockup/D-Mezcla.dc.html.

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