// Sirve en solo lectura los objetos públicos del bucket: fotos y, en la fase 0, pruebas.
// gpx/ y copias/ nunca se exponen.
interface Env {
  FOTOS: R2Bucket;
}

const PREFIJOS_PUBLICOS = ['fotos/', 'pruebas/'];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Método no permitido', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }

    const key = decodeURIComponent(new URL(request.url).pathname.slice(1));
    if (!PREFIJOS_PUBLICOS.some((p) => key.startsWith(p)) || key.includes('..')) {
      return new Response('No encontrado', { status: 404 });
    }

    const objeto = await env.FOTOS.get(key, { onlyIf: request.headers });
    if (!objeto) return new Response('No encontrado', { status: 404 });

    const headers = new Headers();
    objeto.writeHttpMetadata(headers);
    headers.set('etag', objeto.httpEtag);
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    headers.set('access-control-allow-origin', '*');
    headers.set('x-content-type-options', 'nosniff');

    if (!('body' in objeto)) return new Response(null, { status: 304, headers });
    return new Response(request.method === 'HEAD' ? null : objeto.body, { headers });
  },
} satisfies ExportedHandler<Env>;
